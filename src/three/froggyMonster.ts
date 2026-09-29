/**
 * Froggy, in three dimensions -- THE LONG ONE.
 *
 * One model, built once, used by the hide rooms, the alley and the gallery,
 * so the thing that opens the lockers is the thing that comes down the alley
 * and the thing that fills the screen when it finds you.
 *
 * WHAT HE IS NOW.  Not a swollen frog on two legs: a body far too long and far
 * too thin to be anybody's, with Froggy's face on top of it.
 *
 *   THE BODY is emaciated and wrong.  Legs half his height with knobbed
 *   knees; a narrow cage of ribs you can count over a belly that has sunk in
 *   under them; shoulders no wider than the head, all bone; arms that hang
 *   past the knees and end in long jointed fingers.  At room scale he is
 *   well over twice your height, and the length is in the PROPORTIONS -- the
 *   limbs and the trunk -- not in scaling up something the size of a man.
 *
 *   THE HEAD is Froggy's, and it is the whole of the fear: the wide dome, the
 *   two great eyes up on the corners of it, the big pale muzzle with its two
 *   nostrils, all of it kept -- and then made real.  Creased, pored, blotched
 *   skin; heavy lids that never quite close; very small pupils that find you
 *   and stay on you.  It sits on a thin neck with the tendons standing out,
 *   one creature rather than a man in a mask.
 *
 *   THE SKIN is grey and old and damp in patches: see `froggySkin`, which
 *   paints pores, wrinkles, blotching, warts and a separate wet map so the
 *   torch finds a sheen that breaks up across him rather than plastic.
 */

import * as THREE from 'three';
import { froggySkin, roughen } from './froggySkin';

/** Grey, the colour of something kept out of the light. */
/** The body is a shade darker than the face, as it is in the dark. */
/**
 * These look dark in a colour picker and they have to: the only light on him
 * is the player's torch, a spotlight a couple of metres away, and a surface
 * under it comes back several times its own value.  At picker-correct greys
 * he came out bone-white -- a skeleton, not skin.
 */
const SKIN = 0x2c2a27;
const SKIN_DARK = 0x221f1d;
const SKIN_PALE = 0x33312d;
const FACE = 0x3a3835;
/** The muzzle: the pale half of the face, as it is on the mascot. */
const MUZZLE = 0x55524e;
const MOUTH = 0x0b0708;
const LID = 0x33302d;
/**
 * The whites.  A dirty grey-white rather than white: a pure white eye under a
 * torch is a lamp, and a lamp is not looking at you.
 */
const SCLERA = 0x8f8c85;
const PUPIL = 0x020202;
/** The lips: the face's grey, darker and wetter, with a little blood in it. */
const LIP = 0x342d2b;
const MOUTH_WET = 0x0e0606;
/** Old ivory gone yellow-grey. */
const TOOTH = [0x6a624f, 0x5a5242, 0x756c58, 0x4f483a];
/** The mouth's rim, in the head's own units. */
const MOUTH_Y = -0.1;
const MOUTH_Z = 0.085;
/** Half its width: wider than the muzzle was, and a touch wider than the head. */
const MOUTH_W = 0.262;
const MOUTH_D = 0.158;
/** The hinge, well behind the corners of the mouth. */
const JAW_PIVOT_Z = -0.07;

let scleraTex: THREE.CanvasTexture | null = null;
/**
 * The white of the eye, painted rather than built: yellowed toward the rim,
 * with thin red veins creeping in from it and stopping short of the pupil.
 * Laid on a sphere whose pole faces forward, so the top of the canvas is the
 * middle of the eye and the bottom half is the part the socket hides.
 */
function sclera(): THREE.CanvasTexture {
  if (scleraTex) return scleraTex;
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f2f0ea');
  g.addColorStop(0.28, '#e9e5da');
  g.addColorStop(0.45, '#d8cdb4');
  g.addColorStop(0.6, '#b59d83');
  g.addColorStop(1, '#6e5a4c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // blotches of yellowing, low down where the lid would shade it
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(160,130,80,${0.05 + rnd() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * W, H * (0.3 + rnd() * 0.3), 4 + rnd() * 10, 2 + rnd() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the veins: from the rim (y ~ 0.55H) up toward the middle, branching
  const vein = (x: number, y: number, len: number, w: number, depth: number): void => {
    ctx.strokeStyle = `rgba(${150 + rnd() * 40},${30 + rnd() * 20},${30 + rnd() * 16},${0.45 + rnd() * 0.3})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let dx = (rnd() - 0.5) * 2;
    for (let k = 0; k < len; k++) {
      dx += (rnd() - 0.5) * 1.2;
      x += dx * 0.6;
      y -= 1 + rnd() * 1.2;
      ctx.lineTo(x, y);
      if (depth > 0 && rnd() < 0.08) vein(x, y, len * 0.5, w * 0.7, depth - 1);
      if (y < H * 0.14) break;
    }
    ctx.stroke();
  };
  for (let i = 0; i < 26; i++) vein(rnd() * W, H * (0.5 + rnd() * 0.12), 12 + rnd() * 26, 0.6 + rnd() * 0.7, 2);
  scleraTex = new THREE.CanvasTexture(c);
  scleraTex.colorSpace = THREE.SRGBColorSpace;
  scleraTex.wrapS = THREE.RepeatWrapping;
  return scleraTex;
}

/**
 * The whole body is built at the proportions that make him what he is, then
 * set down inside the root at this size, so the dome of his head clears the
 * lowest ceiling a room builds him under.  The rooms' own scales -- which the
 * game also reads for how far he can reach -- stay exactly as they were.
 */
const BODY_SCALE = 0.93;

/** The leg, in model units: hip to knee, knee to ankle, ankle to sole. */
const THIGH = 0.47;
const SHIN = 0.48;
const SOLE = 0.07;

/** Head to floor, in metres, standing, before the room's own scale. */
export const FROGGY_HEIGHT = 2.1;

export interface FroggyPose {
  /** Metres per second he is actually covering.  Drives the walk cycle. */
  speed: number;
  /** 0..1 mouth openness.  Chasing opens it. */
  maw: number;
  /** 0..1 up the side of something.  Pitches him forward and lifts the arms. */
  climb: number;
  /** How far through the climb he is, 0..1. */
  climbT?: number;
  /** Radians the head is turned off his direction of travel. */
  scan?: number;
  /** 0..1 after you.  Folds him lower, lengthens the stride, opens the reach. */
  lunge?: number;
  /** 0..1 down on his haunches, looking UNDER something. */
  crouch?: number;
  /** 0..1 craning about while he is down there. */
  peer?: number;
  /**
   * 0..1 both arms thrown up and forward either side of his head, the hands
   * open -- the reach at something right in front of his face.  Eased fast,
   * because it is the jumpscare's, and a quarter of a second is all it gets.
   */
  grab?: number;
  /**
   * Where the player's head is, in the world, while he is coming for them.
   * The arms reach for it, the head turns to it and the eyes stay on it.
   * Leave it out and he reaches straight ahead, the way he always did.
   */
  reachAt?: THREE.Vector3 | null;
  /**
   * Where the player is looking at him from, whatever he is doing.  Only used
   * to keep his arms off his eyes as seen from there -- climbing, crouching,
   * reaching -- never to aim anything at them.
   */
  viewer?: THREE.Vector3 | null;
  /**
   * How fast the mouth OPENS, per second (it always closes briskly).  Slow by
   * default: noticing you, it comes open over a second or more.
   */
  mawRate?: number;
  /**
   * A hand on something in the world, [left, right]: a door handle, the edge
   * of a lid, the floor.  The arm is solved to put the palm there; `weight`
   * blends it in from wherever the arm was (so it reaches, it does not
   * snap), `grip` closes the fingers round it, and `twist` turns the forearm
   * -- the hand turning a handle.
   */
  hands?: [HandGoal | null, HandGoal | null];
  /** 0..1 stooped over something low he is reaching for, on top of everything else. */
  lean?: number;
  /**
   * 0..1 his head going down into a gap to look in: dipped, and rolled over
   * on its side much further than a neck should go, so one eye comes into
   * the gap before the rest of the face.
   */
  peek?: number;
}

export interface HandGoal {
  at: THREE.Vector3;
  weight: number;
  grip: number;
  twist?: number;
}

interface ArmSpring {
  x: number;
  vx: number;
  z: number;
  vz: number;
  e: number;
  ve: number;
}

export class FroggyMonster {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private jaw = new THREE.Group();
  private chest: THREE.Mesh | null = null;
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private knees: THREE.Group[] = [];
  private ankles: THREE.Group[] = [];
  private elbows: THREE.Group[] = [];
  /** The eyes, each a group turned about its own centre to aim the pupil. */
  private eyes: THREE.Group[] = [];
  private lids: THREE.Mesh[] = [];
  private walkT = 0;
  private breathT = 0;
  private mawNow = 0;
  private climbNow = 0;
  private scanNow = 0;
  private lungeNow = 0;
  /** The fingers on each hand, so they can close on the grab. */
  private hands: THREE.Group[][] = [];
  private reachT = 0;
  private crouchNow = 0;
  private grabNow = 0;
  /** Speed as the legs see it: eased, so a change of pace is a change of gait, not a pop. */
  private speedNow = 0;
  /** The facing the room asked for; he turns to it rather than being snapped to it. */
  private yawWant = 0;
  private yawReady = false;
  /** How far the body has still to turn: the head goes first by this much. */
  private yawLag = 0;
  private readonly armBaseY: number[] = [];
  /** Hip height over the floor while walking, in model units. */
  private hipH = 0;
  /** How close the thing he is reaching for is, 0 far .. 1 on it, eased. */
  private nearNow = 0;
  /** The arms' own momentum: where each one actually is, and how fast it is going. */
  private armSpring: ArmSpring[] = [];
  private lastSpeed = 0;
  private lastHipY = 0;
  private hipV = 0;
  private gazeByReach = false;
  private readonly gazeAt = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tmp3 = new THREE.Vector3();
  private readonly tmp4 = new THREE.Vector3();
  private readonly tmp5 = new THREE.Vector3();
  private readonly tmp6 = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  /** How much each arm is being held on something this frame (for the eye guard). */
  private held = [0, 0];
  private leanNow = 0;
  private peekNow = 0;
  /** Per arm: how far it has been swung out to keep it off his eyes. */
  private clear = [0, 0];
  private readonly eyeW = [new THREE.Vector3(), new THREE.Vector3()];
  private twitchIn = 2.5;
  private twitchT = 0;
  /** Where the eyes are looking, in world space; null to look where he faces. */
  private gaze: THREE.Vector3 | null = null;
  /** The small darts the eyes make on their own. */
  private saccade = new THREE.Vector2();
  private saccadeIn = 1;

  constructor(scale = 1) {
    const tex = froggySkin();
    const flat = (color: number) => new THREE.MeshLambertMaterial({ color });
    /**
     * Skin.  The painted hide as its colour, the same features as relief, and
     * a separate map of where it is damp: tight, broken highlights, never a
     * broad plastic one.
     */
    const hide = (color: number, face = false, bump = 0.02) =>
      new THREE.MeshPhongMaterial({
        color,
        map: face ? tex.face : tex.skin,
        bumpMap: face ? tex.faceBump : tex.skinBump,
        bumpScale: bump,
        specularMap: tex.wet,
        // Damp, not polished: a dim, fairly tight highlight, and only where the
        // wet map lets it through.  Any brighter and the torch made him chrome.
        specular: 0x16150f,
        shininess: 28,
      });
    const skin = hide(SKIN);
    const skinDark = hide(SKIN_DARK);
    const skinPale = hide(SKIN_PALE);
    const face = hide(FACE, true, 0.03);
    const muzzle = hide(MUZZLE, true, 0.024);
    const lidMat = hide(LID, true, 0.03);
    const lumpy = (g: THREE.BufferGeometry, amp: number, freq: number, seed: number) => roughen(g, amp, freq, seed);
    /** Squeeze a geometry about its own y: `top` at the highest point, `bottom` at the lowest. */
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
    /** A limb segment hanging down from its joint: radius, length, taper. */
    const bone = (r: number, len: number, top: number, bot: number, mat: THREE.Material, seed: number, amp = 0.006) => {
      const m = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(r, len, 6, 14), top, bot), amp, 9, seed), mat);
      m.position.y = -len / 2 - r * 0.2;
      return m;
    };
    /** A small ball: a joint, a knuckle, a knob of bone under the skin. */
    const knob = (r: number, mat: THREE.Material, seed: number) =>
      new THREE.Mesh(lumpy(new THREE.SphereGeometry(r, 12, 10), r * 0.12, 14, seed), mat);
    /** A capsule from one point to another, for tendons, collarbones, ribs of the hand. */
    const strut = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 4, 8), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return m;
    };

    // Where everything hangs from, in metres before the room's scale.
    const HIP = 1.02;

    // ================================================================ LEGS
    // Half his height and nothing on them: a long thigh, a knee that is the
    // widest thing on the leg, a longer shin drawn down to almost nothing,
    // and a long flat foot with long toes.
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      // Twist last, so the pelvis's turn can be taken back out of a leg
      // without swinging a foot that is out in front of him sideways.
      leg.rotation.order = 'YXZ';
      leg.position.set(side * 0.1, HIP, 0);
      leg.add(knob(0.068, skin, 3 + side));
      leg.add(bone(0.058, 0.36, 1.12, 0.72, skin, 5 + side));
      // the inside of the thigh, drawn in, and the tendon behind the knee
      const inner = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.04, 0.2, 6, 12), 1.1, 0.5), 0.004, 10, 7 + side), skin);
      inner.position.set(-side * 0.018, -0.14, 0.01);
      leg.add(inner);

      const knee = new THREE.Group();
      knee.position.set(0, -0.47, 0);
      leg.add(knee);
      const kneeKnob = knob(0.046, skin, 9 + side);
      kneeKnob.scale.set(1, 1.1, 1);
      knee.add(kneeKnob);
      const cap = knob(0.026, skin, 11 + side);
      cap.position.set(0, 0.01, 0.042);
      knee.add(cap);
      const shin = bone(0.042, 0.38, 1.08, 0.5, skin, 13 + side);
      knee.add(shin);
      // the wasted calf, a long thin bulge down the back of the shin
      const calf = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.036, 0.16, 6, 12), 0.7, 1.05), 0.004, 10, 15 + side), skin);
      calf.position.set(0, -0.13, -0.018);
      knee.add(calf);
      // the shin bone, a hard ridge down the front
      knee.add(strut(new THREE.Vector3(0, -0.04, 0.03), new THREE.Vector3(0, -0.4, 0.018), 0.012, skinPale));

      const ankle = new THREE.Group();
      ankle.position.set(0, -0.48, 0);
      knee.add(ankle);
      for (const s2 of [-1, 1]) {
        const ab = knob(0.018, skinPale, 17 + s2);
        ab.position.set(s2 * 0.028, 0, 0);
        ankle.add(ab);
      }
      const heel = knob(0.036, skin, 19 + side);
      heel.position.set(0, -0.035, -0.03);
      ankle.add(heel);
      // the foot: long, thin, and flat to the floor
      const foot = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.032, 0.2, 6, 12), 0.7, 1.15), 0.004, 12, 23 + side), skin);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.3, 1, 0.55);
      foot.position.set(0, -0.058, 0.09);
      ankle.add(foot);
      // five long toes, knuckled, fanned a little
      for (let t = 0; t < 5; t++) {
        const sp = (t - 2) * 0.13;
        const len = 0.1 - Math.abs(t - 2) * 0.012;
        const base = new THREE.Vector3(Math.sin(sp) * 0.05 + (t - 2) * 0.011, -0.066, 0.21);
        const tip = base.clone().add(new THREE.Vector3(Math.sin(sp) * len, -0.008, Math.cos(sp) * len));
        ankle.add(strut(base, tip, 0.0105, skin));
        const kn = knob(0.012, skin, 29 + t);
        kn.position.copy(base);
        ankle.add(kn);
      }

      this.hips.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
      this.ankles.push(ankle);
    }

    // ================================================================ TRUNK
    // A small pelvis, a waist sunk in under the ribs, and the cage itself:
    // narrow, egg-shaped, with every rib standing out of it.
    this.torso.position.set(0, HIP, 0);
    const pelvis = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.12, 16, 12), 0.008, 8, 31), skin);
    pelvis.scale.set(1.12, 0.66, 0.82);
    pelvis.position.y = 0.03;
    this.torso.add(pelvis);
    for (const side of [-1, 1]) {
      const crest = knob(0.03, skinPale, 33 + side);
      crest.position.set(side * 0.1, 0.09, 0.03);
      this.torso.add(crest);
    }
    const waist = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.075, 0.2, 8, 14), 1.05, 1.1), 0.006, 9, 37), skin);
    waist.scale.set(1, 1, 0.72);
    waist.position.set(0, 0.2, -0.01);
    this.torso.add(waist);
    const navel = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), flat(0x2a2622));
    navel.position.set(0, 0.16, 0.052);
    this.torso.add(navel);
    // the ribcage
    // The cage under the ribs is the darker skin, sunk between them, so every
    // rib stands out of it as a pale ridge with a shadow either side.
    const chest = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.15, 22, 18), 0.006, 7, 41), skinDark);
    chest.scale.set(0.98, 1.55, 0.78);
    chest.position.set(0, 0.47, 0);
    this.torso.add(chest);
    this.chest = chest;
    // THE RIBS: nine a side, each one fitted to the cage at its own height so
    // it lies ON the skin rather than hooping round it, running from the
    // breastbone round the flank toward the spine, the front of each sloping
    // down the way ribs do.  The bottom ones flare a little where the belly
    // has fallen in under them.
    const CAGE = { y: 0.47, rx: 0.147, ry: 0.2325, rz: 0.117 };
    for (let k = 0; k < 9; k++) {
      const y = 0.645 - k * 0.04;
      const f = Math.sqrt(Math.max(0.05, 1 - ((y - CAGE.y) / CAGE.ry) ** 2));
      const flare = k > 5 ? (k - 5) * 0.006 : 0;
      const rx = CAGE.rx * f + 0.007 + flare;
      const rz = CAGE.rz * f + 0.007 + flare;
      const tube = 0.0078 + Math.sin((k / 8) * Math.PI) * 0.0022;
      const len = 1.95 - Math.abs(k - 4) * 0.05;
      for (const side of [-1, 1]) {
        const g = new THREE.TorusGeometry(rx, tube, 6, 22, len);
        // start just off the breastbone and run round the side, backwards
        g.rotateZ(side > 0 ? Math.PI / 2 - 0.1 - len : Math.PI / 2 + 0.1);
        const arc = new THREE.Mesh(g, skin);
        arc.rotation.x = Math.PI / 2 + 0.2;
        arc.scale.set(1, rz / rx, 1);
        arc.position.set(0, y, 0);
        this.torso.add(arc);
      }
    }
    // the breastbone, on the surface of the cage down its front
    this.torso.add(strut(new THREE.Vector3(0, 0.66, 0.112), new THREE.Vector3(0, 0.36, 0.106), 0.011, skinPale));
    // the spine, a row of knuckles down the back
    for (let k = 0; k < 10; k++) {
      const v = knob(0.016, skinPale, 43 + k);
      v.position.set(0, 0.1 + k * 0.058, -0.105 + Math.sin((k / 9) * Math.PI) * -0.012);
      this.torso.add(v);
    }
    // shoulder blades
    for (const side of [-1, 1]) {
      const sb = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.06, 10, 8), 0.004, 10, 47 + side), skin);
      sb.scale.set(1, 1.3, 0.35);
      sb.position.set(side * 0.08, 0.58, -0.1);
      sb.rotation.z = side * 0.25;
      this.torso.add(sb);
    }
    // collarbones, and the narrow bony shoulders they run out to
    const SH = 0.66;
    for (const side of [-1, 1]) {
      this.torso.add(strut(new THREE.Vector3(side * 0.02, SH + 0.005, 0.085), new THREE.Vector3(side * 0.17, SH - 0.005, 0.02), 0.011, skinPale));
      const sh = knob(0.046, skin, 51 + side);
      sh.position.set(side * 0.175, SH - 0.02, 0);
      this.torso.add(sh);
    }

    // ================================================================ ARMS
    // Hanging past the knees, the elbow a knob of bone, and on the end a
    // hand far too long: a narrow palm and four jointed fingers and a thumb.
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.18, SH - 0.03, 0);
      arm.rotation.z = side * 0.06;
      // Far longer than any person's: the elbow comes level with his hip
      // and the fingertips hang to the middle of his shins.
      arm.add(bone(0.029, 0.5, 1.1, 0.75, skin, 55 + side));
      const elbow = new THREE.Group();
      elbow.position.y = -0.57;
      arm.add(elbow);
      elbow.add(knob(0.026, skin, 57 + side));
      elbow.add(bone(0.023, 0.5, 1.05, 0.6, skin, 59 + side));
      // what is left of the forearm muscle, just below the elbow
      const fore = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.026, 0.15, 6, 12), 1.05, 0.55), 0.003, 10, 60 + side), skin);
      fore.position.set(side * 0.005, -0.13, 0.007);
      elbow.add(fore);
      const wrist = knob(0.018, skin, 61 + side);
      wrist.position.y = -0.57;
      elbow.add(wrist);
      const palm = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.04, 12, 10), 0.003, 12, 63 + side), skin);
      palm.scale.set(0.9, 1.6, 0.4);
      palm.position.set(0, -0.635, 0);
      elbow.add(palm);
      const hand: THREE.Group[] = [];
      for (let f = 0; f < 5; f++) {
        const thumb = f === 4;
        const finger = new THREE.Group();
        finger.position.set(thumb ? 0 : (f - 1.5) * 0.016, thumb ? -0.61 : -0.69, thumb ? 0.03 : 0);
        if (thumb) finger.rotation.set(0.4, 0, side * 0.5);
        const L1 = thumb ? 0.09 : 0.15 - Math.abs(f - 1.5) * 0.012;
        const L2 = thumb ? 0.07 : 0.13 - Math.abs(f - 1.5) * 0.01;
        finger.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L1, 0.004), 0.0075, skin));
        const k1 = knob(0.0088, skin, 67 + f);
        k1.position.set(0, -L1, 0.004);
        finger.add(k1);
        const tipSeg = new THREE.Group();
        tipSeg.position.set(0, -L1, 0.004);
        tipSeg.rotation.x = 0.18;
        tipSeg.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L2, 0), 0.0062, skin));
        finger.add(tipSeg);
        elbow.add(finger);
        hand.push(finger);
      }
      this.hands.push(hand);
      this.torso.add(arm);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }

    // ================================================================ NECK
    // Thin, with the two tendons standing out of it in a V down to the top of
    // the breastbone, and the head sat on it -- one creature, not a mask.
    this.neck.position.set(0, SH + 0.02, 0.01);
    const column = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.042, 0.12, 6, 12), 0.95, 1.2), 0.004, 10, 71), skin);
    column.position.y = 0.07;
    this.neck.add(column);
    for (const side of [-1, 1]) {
      this.neck.add(strut(new THREE.Vector3(side * 0.05, 0.16, -0.005), new THREE.Vector3(side * 0.012, -0.015, 0.075), 0.011, skinPale));
    }
    const apple = knob(0.014, skinPale, 73);
    apple.position.set(0, 0.07, 0.04);
    this.neck.add(apple);

    // ================================================================ HEAD
    // FROGGY'S HEAD.  The wide dome, the eyes up on its corners, the big pale
    // muzzle -- the mascot's own shapes, at the proportions of the mascot,
    // made of the same grey skin as the rest of him.
    this.head.position.set(0, 0.22, 0.025);
    this.head.scale.setScalar(1.14);
    this.neck.add(this.head);
    const dome = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.2, 28, 22), 0.006, 6, 79), face);
    dome.scale.set(1.28, 0.9, 1.0);
    dome.position.set(0, 0.03, 0);
    this.head.add(dome);
    // cheeks, so the jaw line is broad and the face fills out below the eyes
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.12, 14, 12), 0.004, 8, 81 + side), face);
      cheek.scale.set(1, 0.85, 1);
      cheek.position.set(side * 0.13, -0.04, 0.03);
      this.head.add(cheek);
    }
    // the muzzle: the pale half of the face
    // -- the upper half of it: a half-dome whose flat underside IS the mouth,
    // so when the jaw goes there is nothing in the way.  It is widest at the
    // bottom, which makes the mouth the widest thing on the face: a little
    // wider than the head it is on.
    const snout = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.2, 30, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), 0.004, 7, 83), muzzle);
    snout.scale.set(MOUTH_W / 0.2, 0.19 / 0.2, MOUTH_D / 0.2);
    snout.position.set(0, MOUTH_Y, MOUTH_Z);
    this.head.add(snout);
    // two nostrils, set into the top of it
    for (const side of [-1, 1]) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), flat(0x151210));
      n.scale.set(1, 0.8, 0.6);
      n.position.set(side * 0.042, 0.02, 0.232);
      this.head.add(n);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 4, 10), muzzle);
      rim.position.set(side * 0.042, 0.022, 0.23);
      this.head.add(rim);
    }
    // THE EYES.  Up on the corners of the dome, far bigger than any animal's,
    // grey-white, each with a very small black pupil -- and a heavy lid over
    // the top of each that never lifts, so the stare has no expression in it.
    for (const side of [-1, 1]) {
      const ex = side * 0.138;
      const ey = 0.15;
      const ez = 0.075;
      const socket = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.122, 20, 16), 0.004, 9, 87 + side), face);
      socket.position.set(ex, ey - 0.014, ez - 0.05);
      this.head.add(socket);
      const eye = new THREE.Group();
      eye.position.set(ex, ey, ez + 0.012);
      this.head.add(eye);
      // fine veins creeping in from the rim, painted on, thin enough to be
      // seen only up close -- which is where you will be
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.108, 28, 20),
        new THREE.MeshPhongMaterial({ color: SCLERA, map: sclera(), specular: 0x2a2a26, shininess: 60 }),
      );
      white.rotation.x = Math.PI / 2;
      white.rotation.y = side * 0.7;
      white.name = 'sclera';
      eye.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 10, 8), flat(PUPIL));
      pupil.scale.set(1, 1, 0.45);
      pupil.position.set(0, 0, 0.106);
      pupil.name = 'pupil';
      eye.add(pupil);
      this.eyes.push(eye);
      // the lid: a thin cap of skin over the very top of the eye and a rim
      // round it -- the eye stays wide open, which is the stare
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.113, 22, 8, 0, Math.PI * 2, 0, Math.PI * 0.2), lidMat);
      lid.position.set(ex, ey, ez);
      lid.rotation.x = 0.2;
      const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.009, 6, 28), lidMat);
      lidRim.position.set(ex, ey, ez + 0.035);
      this.head.add(lidRim);
      this.head.add(lid);
      this.lids.push(lid);
      // creases under and round the eye, which is what ages a face
      for (let c = 0; c < 2; c++) {
        const crease = new THREE.Mesh(new THREE.TorusGeometry(0.125 + c * 0.016, 0.004, 4, 14, Math.PI * 0.6), face);
        crease.position.set(ex, ey - 0.012, ez - 0.01 - c * 0.008);
        crease.rotation.set(0.25, 0, Math.PI + Math.PI * 0.15);
        this.head.add(crease);
      }
    }
    // a furrow across the brow between the eyes
    for (let c = 0; c < 3; c++) {
      const f = new THREE.Mesh(new THREE.TorusGeometry(0.07 + c * 0.012, 0.004, 4, 12, Math.PI * 0.5), face);
      f.position.set(0, 0.16 - c * 0.02, 0.13 - c * 0.01);
      f.rotation.set(-0.4, 0, Math.PI * 0.25);
      this.head.add(f);
    }
    // warts and marks scattered over the dome
    for (let w = 0; w < 14; w++) {
      const a = (w / 14) * Math.PI * 2;
      const wart = knob(0.007 + (w % 3) * 0.003, skinDark, 91 + w);
      wart.position.set(Math.cos(a) * 0.2, 0.09 + Math.sin(a * 2.3) * 0.05, -0.02 + Math.sin(a) * 0.14);
      this.head.add(wart);
    }

    // ---- THE MOUTH.
    //
    // Not a frog's and not a smile.  A lipless-looking seam that runs right
    // round the front of the muzzle and on past where the cheeks end, so it is
    // a little too wide for the face it is in; the corners turn DOWN, and one
    // turns down further than the other.  Nothing about it is exaggerated, and
    // it is wrong anyway.  Closed, it is a line.  Open, the jaw drops a long
    // way on a hinge set too far back, skewed very slightly, onto a dark wet
    // mouth and rows of thin, uneven, discoloured teeth -- needles, not fangs,
    // the kind a deep-water fish has.  The teeth are inside the closed mouth
    // and cannot be seen until it opens.
    const lipMat = new THREE.MeshPhongMaterial({
      color: LIP,
      map: tex.face,
      bumpMap: tex.faceBump,
      bumpScale: 0.03,
      specular: 0x2a2320,
      shininess: 44,
    });
    const wet = new THREE.MeshPhongMaterial({ color: MOUTH_WET, specular: 0x3a2a28, shininess: 70 });
    const toothMats = TOOTH.map((color) => new THREE.MeshPhongMaterial({ color, specular: 0x2c2a22, shininess: 40 }));
    /** A point on the mouth's rim, `a` round from the right corner (0) to the left (PI). */
    const rim = (a: number, inset: number, droop: number): THREE.Vector3 => {
      const c = Math.cos(a);
      // the corners drop, and the left one (a > PI/2) drops further
      const fall = droop * Math.pow(Math.abs(c), 4) * (c < 0 ? 1.3 : 1);
      return new THREE.Vector3(c * MOUTH_W * inset, -fall, MOUTH_Z + Math.sin(a) * MOUTH_D * inset);
    };
    const lipLine = (y0: number, bulge: number, droop: number, seed: number): THREE.Mesh => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = -0.32 + (i / 24) * (Math.PI + 0.64);
        const p = rim(a, bulge, droop);
        p.y += y0;
        pts.push(p);
      }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0058, 6, false);
      // thin out to nothing at the corners, where the lips run into the skin
      const pos = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const centre = new THREE.Vector3();
      const curve = new THREE.CatmullRomCurve3(pts);
      for (let v = 0; v < pos.count; v++) {
        const u = uv.getX(v);
        const k = Math.min(1, Math.sin(u * Math.PI) * 2.2);
        curve.getPoint(u, centre);
        pos.setXYZ(
          v,
          centre.x + (pos.getX(v) - centre.x) * k,
          centre.y + (pos.getY(v) - centre.y) * k * 0.8,
          centre.z + (pos.getZ(v) - centre.z) * k,
        );
      }
      g.computeVertexNormals();
      return new THREE.Mesh(lumpy(g, 0.0015, 30, seed), lipMat);
    };
    // the upper lip, on the rim of the half-dome
    const upperLip = lipLine(MOUTH_Y - 0.002, 1.015, 0.024, 95);
    this.head.add(upperLip);
    // the roof of the mouth, dark and wet, closing the underside of the dome
    const palate = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), wet);
    palate.rotation.x = Math.PI / 2;
    palate.scale.set((MOUTH_W / 0.2) * 0.985, (MOUTH_D / 0.2) * 0.985, 1);
    palate.position.set(0, MOUTH_Y + 0.001, MOUTH_Z);
    this.head.add(palate);
    // the back of the mouth, where the dark goes on down
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), flat(MOUTH));
    throat.scale.set(1.25, 0.55, 0.8);
    throat.position.set(0, MOUTH_Y - 0.03, MOUTH_Z - 0.06);
    this.head.add(throat);
    /**
     * A row of teeth round the rim.  Irregular in every way a real row is:
     * length, thickness, lean, spacing, a gap or two where one is missing, and
     * the longest ones not at the front.
     */
    const teeth = (parent: THREE.Object3D, y: number, down: boolean, inset: number, n: number, seed: number): void => {
      let r = seed;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        if (rnd() < 0.08) continue; // one missing
        const a = 0.12 + ((i + 0.5 + (rnd() - 0.5) * 0.6) / n) * (Math.PI - 0.24);
        const side = Math.abs(Math.cos(a));
        // short at the front, longer toward the sides, and a few much longer
        const h = (0.012 + rnd() * 0.014) * (0.8 + side * 0.6) * (rnd() < 0.15 ? 1.6 : 1);
        const w = 0.0026 + rnd() * 0.0022;
        const g = new THREE.ConeGeometry(w, h, 5, 1);
        g.translate(0, h / 2, 0);
        // a slight hook toward the throat at the tip
        const pos = g.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < pos.count; v++) {
          const t = pos.getY(v) / h;
          pos.setZ(v, pos.getZ(v) - t * t * h * 0.28);
        }
        g.computeVertexNormals();
        const tooth = new THREE.Mesh(g, toothMats[Math.floor(rnd() * toothMats.length)]);
        const p = rim(a, inset, down ? 0.024 : 0);
        tooth.position.set(p.x, y + p.y, p.z);
        // point down (upper) or up (lower), and face the throat
        tooth.rotation.set(down ? Math.PI : 0, -a + Math.PI / 2 + (down ? Math.PI : 0), 0, 'YXZ');
        tooth.rotation.z = (rnd() - 0.5) * 0.35;
        tooth.rotation.x += (rnd() - 0.5) * 0.3;
        parent.add(tooth);
      }
    };
    teeth(this.head, MOUTH_Y + 0.004, true, 0.88, 26, 1301);
    // mouth-corner creases, the skin gathered where the seam ends
    for (const side of [-1, 1]) {
      for (let c = 0; c < 3; c++) {
        const a = side > 0 ? -0.26 : Math.PI + 0.26;
        const p = rim(a, 1.02, 0.024);
        const q = p.clone().add(new THREE.Vector3(side * (0.012 + c * 0.004), 0.018 - c * 0.02, -0.018 - c * 0.004));
        p.y += MOUTH_Y;
        q.y += MOUTH_Y;
        this.head.add(strut(p, q, 0.0032, skinDark));
      }
    }
    // THE JAW: hinged well behind the corners, which is what lets it drop as
    // far as it does.
    this.jaw.position.set(0, MOUTH_Y, JAW_PIVOT_Z);
    const chin = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.2, 30, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0.004, 8, 97), muzzle);
    chin.scale.set((MOUTH_W / 0.2) * 0.965, 0.1 / 0.2, (MOUTH_D / 0.2) * 0.965);
    chin.position.set(0, 0, MOUTH_Z - JAW_PIVOT_Z);
    this.jaw.add(chin);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), wet);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set((MOUTH_W / 0.2) * 0.95, (MOUTH_D / 0.2) * 0.95, 1);
    floor.position.set(0, -0.001, MOUTH_Z - JAW_PIVOT_Z);
    this.jaw.add(floor);
    const lowerLip = lipLine(-0.002, 0.985, 0.0, 99);
    lowerLip.position.z = -JAW_PIVOT_Z;
    this.jaw.add(lowerLip);
    const lower = new THREE.Group();
    lower.position.z = -JAW_PIVOT_Z;
    this.jaw.add(lower);
    teeth(lower, -0.004, false, 0.86, 22, 2203);
    this.head.add(this.jaw);

    this.torso.add(this.neck);
    this.hips.add(this.torso);
    const body = new THREE.Group();
    body.scale.setScalar(BODY_SCALE);
    body.add(this.hips);
    this.root.add(body);
    this.root.scale.setScalar(scale);
  }

  /** World units per model unit: the room's scale and the body's together. */
  get size(): number {
    return this.root.scale.x * BODY_SCALE;
  }

  /**
   * Point his eyes at something in the world -- the camera, for the stare --
   * or pass null and they look where he is facing, with their own small darts.
   */
  lookAt(target: THREE.Vector3 | null): void {
    this.gaze = target ? target.clone() : null;
  }

  /** The head, for anything that needs to put a camera in front of his face. */
  get headObject(): THREE.Object3D {
    return this.head;
  }

  /** Drop him into the world.  `y` is the floor he is standing on. */
  setPose(x: number, y: number, z: number, yaw: number): void {
    // Put somewhere new (a teleport, a respawn, the first frame), he is just
    // there, facing the way he was asked.  Otherwise he TURNS to it, in
    // `update`: the room's AI snaps his heading, and a snap on a body this
    // long reads as the whole creature rotating on a pin.
    const jump = !this.yawReady || Math.hypot(x - this.root.position.x, z - this.root.position.z) > 2.5;
    this.root.position.set(x, y, z);
    this.yawWant = yaw;
    if (jump) {
      this.root.rotation.y = yaw;
      this.yawReady = true;
    }
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
    // The IK below writes whole rotations; everything else only ever writes
    // x and z, so the axes it leaves behind are cleared here.
    for (let h = 0; h < 2; h++) {
      this.arms[h].rotation.y = 0;
      this.elbows[h].rotation.y = 0;
    }
    this.leanNow += ((pose.lean ?? 0) - this.leanNow) * Math.min(1, dt * 3);
    // slow: the head goes into a gap deliberately, and comes out the same way
    this.peekNow += ((pose.peek ?? 0) - this.peekNow) * Math.min(1, dt * 4);

    // Ease every shape change so nothing pops between frames.
    // The mouth comes open SLOWLY -- over a second or more, while he looks at
    // you -- and shuts quickly.
    const mawRate = pose.maw > this.mawNow ? (pose.mawRate ?? 0.9) : 4;
    this.mawNow += (pose.maw - this.mawNow) * Math.min(1, dt * mawRate);
    this.climbNow += (pose.climb - this.climbNow) * Math.min(1, dt * 5);
    this.scanNow += ((pose.scan ?? 0) - this.scanNow) * Math.min(1, dt * 2.5);
    this.lungeNow += ((pose.lunge ?? 0) - this.lungeNow) * Math.min(1, dt * 4);
    // Slower than the rest: going down on his haunches is a deliberate act and
    // it has to read as one.  Three and a half gives about a second either
    // way, which is long enough to watch and short enough to be alarming.
    this.crouchNow += ((pose.crouch ?? 0) - this.crouchNow) * Math.min(1, dt * 3.5);
    this.grabNow += ((pose.grab ?? 0) - this.grabNow) * Math.min(1, dt * 14);

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

    // ---- THE TURN.  Toward the heading the room gave him, fast but not
    // instantly, and the head leads it: it gets there first and the body
    // comes round after it.
    {
      let d = this.yawWant - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = THREE.MathUtils.clamp(d * Math.min(1, dt * 7), -dt * 5, dt * 5);
      this.root.rotation.y += turn;
      this.yawLag = d - turn;
    }

    // ---- THE GAIT.
    //
    // Each foot is either ON THE FLOOR or IN THE AIR, never gliding.  On the
    // floor it travels straight back under him at exactly the speed he is
    // covering ground -- the stride is sized to the length of his leg and the
    // cadence to his speed, so the planted foot stays put in the world.  In
    // the air the knee comes up high, the foot trails toes-down and comes in
    // to land toes first, the way something that is not a person walks.
    // The hips ride on whichever leg is holding him, so they rise over it and
    // drop between, and roll and sway over to it: the weight goes from one
    // foot to the other instead of floating along.
    //
    // (On this rig a POSITIVE hip rotation swings the foot BACK, and a positive
    // knee bends the shin back.  The old walk had that inside out: the knee
    // folded while the foot was planted and locked while it swung.)
    this.speedNow += (speed - this.speedNow) * Math.min(1, dt * 4);
    const sp = this.speedNow;
    const sz = this.size;
    // Pace is judged against HIS size: four metres a second is a stroll for
    // something this tall, and the rooms' search speed is exactly that.
    const pace = sp / Math.max(0.01, sz);
    const moving = THREE.MathUtils.smoothstep(pace, 0.03, 0.55);
    const run = THREE.MathUtils.smoothstep(pace, 3.0, 4.6);
    const legLen = THIGH + SHIN + SOLE;
    // Metres covered per full cycle (two steps), in the world: long, slow
    // strides at a walk -- nearly two leg-lengths a cycle -- and longer still
    // at a run, so even the chase is a lope rather than a scurry.
    const strideW = sz * legLen * (1.9 + 0.55 * run);
    this.walkT += dt * (sp / Math.max(0.1, strideW));
    const phase = this.walkT * Math.PI * 2;
    const gait = Math.sin(phase);
    // the share of each cycle a foot spends on the floor: long for the stalk,
    // short enough at a run that both are sometimes off it
    const duty = 0.62 - 0.22 * run;
    // half the planted foot's sweep, in model units
    const half = (duty * strideW) / 2 / Math.max(0.01, sz);
    const th = [0, 0];
    const kn = [0, 0];
    const lift = [0, 0];
    const planted = [0, 0];
    const ank = [0, 0];
    const footX = [0, 0];
    const footY = [0, 0];
    /** How much each foot holds the hips down: 1 planted, coming on as a foot reaches to land. */
    const bear = [0, 0];
    const reachMax = THIGH + SHIN;
    for (let i = 0; i < 2; i++) {
      const pp = (this.walkT + i * 0.5) % 1;
      // the limp: the right leg a shade shorter in its stride than the left
      const limp = i === 1 ? 0.9 : 1;
      if (pp < duty) {
        // ON THE FLOOR: front to back in a straight line
        const st = pp / duty;
        footX[i] = (1 - 2 * st) * half * limp;
        footY[i] = 0;
        // coming down toes first, the heel settling after
        ank[i] = st < 0.14 ? 0.32 * (1 - st / 0.14) : 0;
        planted[i] = 1;
        bear[i] = 1;
      } else {
        // IN THE AIR: back to front, eased, the foot drawn up high -- higher
        // than a person lifts one, which is half of what makes it wrong
        const u = (pp - duty) / (1 - duty);
        footX[i] = (-1 + 2 * THREE.MathUtils.smoothstep(u, 0, 1)) * half * limp;
        lift[i] = Math.sin(Math.PI * u);
        footY[i] = lift[i] * (0.2 + 0.08 * run) * Math.min(1, half / 0.3);
        // toes trailing off the push, up to clear, then pointed to land
        ank[i] = u < 0.3 ? 0.55 * (1 - u / 0.3) : u > 0.7 ? 0.32 * ((u - 0.7) / 0.3) : -0.12;
        // the body starts to come down onto a foot before it lands
        bear[i] = THREE.MathUtils.smoothstep(u, 0.5, 1);
      }
    }
    // THE HIPS sit as high as the planted feet allow -- never higher, or a
    // foot would leave the floor, and never so low a knee has nothing left --
    // so they drop into each double-support and rise over each single leg.
    const top = reachMax * 0.985;
    let want = top;
    for (let i = 0; i < 2; i++) {
      const r = Math.sqrt(Math.max(0.01, top ** 2 - footX[i] ** 2));
      want = Math.min(want, top + (r - top) * bear[i]);
    }
    // rising takes a moment, dropping does not: a planted foot must never be
    // asked to reach below the floor
    this.hipH = Math.min(want, (this.hipH || want) + dt * 2.5);
    const hipH = this.hipH;
    // THE LEGS, solved: each ankle put exactly where its foot has to be.
    for (let i = 0; i < 2; i++) {
      // measured from this hip joint, which the pelvis's twist carries a
      // little forward or back
      const z = footX[i] + (i === 0 ? -1 : 1) * 0.1 * Math.sin(this.hips.rotation.y);
      const h = Math.max(0.05, hipH - footY[i]);
      const d = Math.min(reachMax * 0.999, Math.hypot(z, h));
      const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((THIGH * THIGH + SHIN * SHIN - d * d) / (2 * THIGH * SHIN), -1, 1));
      const along = Math.acos(THREE.MathUtils.clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
      // forward is negative on this rig; the knee always points forward
      th[i] = -(Math.atan2(z, h) + along) * moving;
      kn[i] = bend * moving;
      ank[i] *= moving;
    }
    const gaitDrop = (hipH + SOLE - legLen) * moving;
    // weight over the planted leg: sway toward it, the free hip dropping
    const sway = (lift[0] - lift[1]) * (0.026 - 0.01 * run) * moving;
    const roll = (lift[0] - lift[1]) * (0.07 - 0.03 * run) * moving;
    // the hip on the forward leg comes forward with it
    const pelvisYaw = (th[1] - th[0]) * 0.22;

    // ---- DOWN ON HIS HAUNCHES.  A squat, built the way a squat is: the thigh
    // comes forward, the knee folds hard under it, and the hips drop by what
    // that costs in leg length.  Applied on top of the stride rather than
    // instead of it, so he can still be settling as he arrives.
    const cr = this.crouchNow;
    this.legs[0].rotation.x = th[0] + cr * 0.62;
    this.legs[1].rotation.x = th[1] + cr * 0.62;
    this.knees[0].rotation.x = kn[0] + this.climbNow * 1.1 + cr * 1.35;
    this.knees[1].rotation.x = kn[1] + this.climbNow * 1.1 + cr * 1.35;

    // And the foot: flat to the floor when it is on it, whatever the leg is
    // doing above it; pointed as it leaves and as it lands.  Let go of on a
    // climb -- there is no floor to be level with halfway up a cupboard.
    const level = (i: number) =>
      THREE.MathUtils.clamp(-(this.legs[i].rotation.x + this.knees[i].rotation.x - this.climbNow * 1.1), -0.55 - cr * 0.7, 0.55 + cr * 0.7) *
      (1 - this.climbNow);
    this.ankles[0].rotation.x = level(0) + ank[0] * (1 - cr);
    this.ankles[1].rotation.x = level(1) + ank[1] * (1 - cr);

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
    // and the grabbing quickens as he closes on you
    this.reachT += dt * (2.6 + reach * 1.6 + this.nearNow * reach * 2.2);
    /** 0 drawn back with the hands shut, 1 thrown out with them open. */
    const grabOf = (phase: number): number => 0.5 + 0.5 * Math.sin(this.reachT + phase);
    const gL = grabOf(0);
    const gR = grabOf(0.7);
    // Forward is NEGATIVE rotation.x on an arm hanging off a shoulder -- see
    // the climb reach below, which is the same sign.
    const armReach = (g: number): number => -reach * (1.05 + 0.5 * g);
    const elbowReach = (g: number): number => -reach * (0.15 + 0.75 * (1 - g));
    const carry = 1 - reach * 0.66;

    // Each arm swings with the OPPOSITE leg, and further than a person's
    // would: the long arms are thrown by the walk more than they are moved.
    const armSwing = [th[1] * (0.42 + 0.25 * run), th[0] * (0.42 + 0.25 * run)];
    this.arms[0].rotation.x =
      armSwing[0] * carry - this.climbNow * 2.2 - haul * 0.55 + armReach(gL);
    this.arms[1].rotation.x =
      armSwing[1] * carry - this.climbNow * 2.2 + haul * 0.55 + armReach(gR);
    // the elbow folds as the arm comes forward, and hangs open going back
    this.elbows[0].rotation.x =
      -(0.2 + Math.max(0, -armSwing[0]) * (0.7 + 0.5 * run)) * carry - this.climbNow * 0.5 + haul * 0.45 + elbowReach(gL);
    this.elbows[1].rotation.x =
      -(0.2 + Math.max(0, -armSwing[1]) * (0.7 + 0.5 * run)) * carry - this.climbNow * 0.5 - haul * 0.45 + elbowReach(gR);
    // the shoulders ride up and down with the step, one against the other
    for (let h = 0; h < 2; h++) {
      if (this.armBaseY.length < 2) this.armBaseY.push(this.arms[h].position.y);
      this.arms[h].position.y = this.armBaseY[h] + lift[1 - h] * 0.014 * (1 - reach * 0.5) - lift[h] * 0.006;
    }
    // Out wide on the push, in on the pull: the gap between his hands opens
    // and closes around where you are standing.
    this.arms[0].rotation.z = this.climbNow * 0.35 - reach * (0.1 + 0.26 * gL);
    this.arms[1].rotation.z = this.climbNow * 0.35 + reach * (0.1 + 0.26 * gR);
    // And the hands close as they come back, which is what makes it a grab
    // rather than a wave.
    for (let h = 0; h < this.hands.length; h++) {
      const g = h === 0 ? gL : gR;
      // the long fingers hang a little curled, and curl shut on the grab
      for (let f = 0; f < this.hands[h].length; f++) {
        const finger = this.hands[h][f];
        const idle = 0.12 + Math.sin(this.breathT * 0.9 + f * 1.3 + h) * 0.05;
        // each finger working on its own, a little, as they reach
        const work = Math.sin(this.breathT * (7 + f * 1.3) + h * 2 + f) * 0.14 * reach;
        finger.rotation.x = (f === 4 ? 0.4 : 0) + idle + reach * (0.15 + 0.95 * (1 - g)) + work;
      }
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
    const breath = Math.sin(this.breathT * 1.5) * 0.01;
    // And the hips come down by what the fold costs: on the long legs, 0.64
    // of a 1.02 hip puts his face at about the height of the gap under a bed,
    // which is the whole point of the pose.
    this.hips.position.y = gaitDrop * (1 - cr) * (1 - this.climbNow) + breath + crest * 0.12 - cr * 0.64;
    this.hips.position.x = sway * (1 - cr);
    // ---- HE BREATHES WRONG.  The cage swells and falls on a slow rhythm
    // with a catch in it -- two quick shallow pulls, then a long one -- so
    // the one part of him that moves standing still does not move like an
    // animal's.
    if (this.chest) {
      const b = this.breathT;
      const hitch = Math.max(0, Math.sin(b * 0.9)) * 0.045 + Math.max(0, Math.sin(b * 4.4)) * 0.012 * (Math.sin(b * 0.45) > 0.3 ? 1 : 0);
      this.chest.scale.set(0.98 + hitch * 0.4, 1.55 + hitch, 0.78 + hitch * 0.9);
    }
    // A slight roll off the same limp, so his weight goes side to side.
    this.hips.rotation.z = roll * (1 - cr);
    this.hips.rotation.y = pelvisYaw * (1 - cr);
    // ...and the legs take that roll, sway and twist back out of themselves,
    // so the pelvis moves over the feet and the feet stay where they are
    for (let i = 0; i < 2; i++) {
      this.legs[i].rotation.z = (-roll - Math.asin(THREE.MathUtils.clamp(sway / Math.max(0.3, this.hipH), -0.3, 0.3))) * (1 - cr);
      this.legs[i].rotation.y = -pelvisYaw * (1 - cr);
    }

    // Folded forward, further the faster he moves, and further again once he is
    // coming for you.  A climb folds him over whatever he is on top of.
    // Upright, with a stoop that never straightens: he is too tall for every
    // room he is in.  Faster and hunting, the stoop deepens into a prowl.
    // Chasing, the whole long body goes after you: folded well forward, and
    // further still as he closes.
    this.torso.rotation.x =
      0.14 + Math.min(0.2, speed * 0.05) + this.climbNow * 0.45 + this.lungeNow * (0.42 + this.nearNow * 0.1) +
      cr * 0.62 + this.leanNow * 0.55 +
      // flat to the floor to get his face down to a gap
      this.peekNow * 0.36;
    // The shoulders twist against the hips -- the whole long back wrings a
    // little with every step -- and lean out over the planted foot.
    this.torso.rotation.y = -pelvisYaw * 1.7 * (1 - cr);
    this.torso.rotation.z = -roll * 0.6 + gait * 0.02 * moving;

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
      -0.04 - Math.min(0.16, speed * 0.04) - this.climbNow * 0.2 - this.lungeNow * 0.36 +
      cr * 0.5 - this.leanNow * 0.3;
    // Craning: slow, small, side to side, and offset from the body's own sway
    // so the two never line up into something that looks mechanical.
    this.neck.rotation.y =
      this.scanNow + twitch + Math.sin(this.breathT * 1.9) * 0.3 * peer +
      // the head holds its line while the body wrings under it...
      pelvisYaw * 0.7 * (1 - cr) +
      // ...and gets round a turn before the body does
      THREE.MathUtils.clamp(this.yawLag * 0.8, -0.7, 0.7);
    // and the head cocks: slowly over to one side and back, the way a thing
    // does that is listening for you
    this.neck.rotation.z =
      -gait * 0.05 + twitch * 0.4 + Math.sin(this.breathT * 1.3 + 1.1) * 0.16 * peer +
      Math.sin(this.breathT * 0.37) * 0.09 +
      // over on its side to look into a gap
      this.peekNow * (1.2 + Math.sin(this.breathT * 0.8) * 0.08);
    this.neck.rotation.x += this.peekNow * 0.6;

    // The arms come FORWARD and down to take his weight on the floor.  The
    // sign matters and it is not the legs': on an arm hanging from a shoulder,
    // negative rotation.x is the way the climb reach goes, which is forward --
    // positive swung both of them out behind him like oars.
    if (cr > 0.001) {
      for (const arm of this.arms) arm.rotation.x -= cr * 0.55;
      for (const el of this.elbows) el.rotation.x -= cr * 0.3;
    }

    // ---- THE ARMS HANG.  They are long and they are heavy and gravity has
    // them: however far forward he stoops, they hang straight down from the
    // shoulder, in front of him, low -- rather than tipping back with the
    // torso like the arms of a doll.  Fades out as they come up to reach.
    const hang = (this.torso.rotation.x + this.hips.rotation.x) * (1 - reach) * (1 - this.climbNow) * (1 - cr);
    for (const arm of this.arms) arm.rotation.x -= hang * 0.95 + 0.05 * (1 - reach);

    // ---- REACHING FOR YOU.
    //
    // Chasing, both arms go for the player's head: aimed at it, a little to
    // either side of it, so as he closes the hands come past your face into
    // the edges of what you can see rather than through the middle of it.
    // The grabbing stroke stays on top -- thrown out open, drawn back shut --
    // and gets shorter, faster and more desperate the closer he is.
    const target = pose.reachAt ?? null;
    let near = 0;
    if (target && reach > 0.01) {
      const d = Math.hypot(target.x - this.root.position.x, target.z - this.root.position.z);
      near = THREE.MathUtils.clamp(1 - (d - 1.2) / 5, 0, 1);
      this.torso.updateWorldMatrix(true, true);
      const inv = this.torso.getWorldQuaternion(this.q).invert();
      // his facing, flat, and the "ready" line: out in front and well down
      const fwd = this.tmp2.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
      const right = this.tmp3.set(fwd.z, 0, -fwd.x);
      for (let h = 0; h < 2; h++) {
        const out = h === 0 ? -1 : 1;
        const arm = this.arms[h];
        const sh = arm.getWorldPosition(this.tmp4);
        // At your head -- converging on you further off, either side of you
        // close up, so the hands come past your face into the edges of view.
        const aim = this.tmp.copy(target).addScaledVector(right, out * (0.04 + near * 0.4) * this.size).sub(sh).normalize();
        // Further off the arms are held out low in front of him, hands open,
        // and they come up onto you as he closes: the reach grows.
        const ready = this.tmp5.copy(fwd).multiplyScalar(Math.cos(0.75)).add(this.tmp6.set(0, -Math.sin(0.75), 0));
        const dir = ready.lerp(aim, 0.35 + near * 0.65).normalize().applyQuaternion(inv);
        // the Euler that points a hanging arm (0,-1,0) along `dir`
        const zA = Math.asin(THREE.MathUtils.clamp(dir.x, -1, 1));
        const xA = Math.atan2(-dir.z, -dir.y);
        const g = h === 0 ? gL : gR;
        const pull = (1 - g) * (0.45 - near * 0.2);
        arm.rotation.x += (xA + pull - arm.rotation.x) * reach;
        arm.rotation.z += (zA + out * (1 - g) * 0.1 - arm.rotation.z) * reach;
        const el = this.elbows[h];
        el.rotation.x += (-(0.1 + (1 - g) * (0.75 - near * 0.3)) - el.rotation.x) * reach;
      }
      // the head goes to you as well, and the eyes do not leave you
      const at = this.torso.worldToLocal(this.tmp.copy(target)).sub(this.neck.position);
      const pitch = THREE.MathUtils.clamp(Math.atan2(-at.y, Math.max(0.05, at.z)), -0.6, 0.85);
      const yaw = THREE.MathUtils.clamp(Math.atan2(at.x, at.z), -0.9, 0.9);
      this.neck.rotation.x += (pitch - this.neck.rotation.x) * reach * 0.75;
      this.neck.rotation.y += (yaw - this.neck.rotation.y) * reach * 0.85;
      this.gaze = this.gazeAt.copy(target);
      this.gazeByReach = true;
    } else if (this.gazeByReach) {
      this.gaze = null;
      this.gazeByReach = false;
    }
    this.nearNow += (near - this.nearNow) * Math.min(1, dt * 3);

    // ---- MOMENTUM.  Everything above says where the arms WANT to be; they
    // get there on springs, a little late and a little past, so the long arms
    // swing with his stride and whip with his turns instead of being carried
    // like poles.  Speeding up leaves them behind; each footfall's dip bounces
    // an arm that is held out in front of him.
    const sdt = Math.min(dt, 0.05);
    const accel = THREE.MathUtils.clamp((speed - this.lastSpeed) / Math.max(sdt, 1e-4), -25, 25);
    this.lastSpeed = speed;
    const hipV = (this.hips.position.y - this.lastHipY) / Math.max(sdt, 1e-4);
    const hipA = THREE.MathUtils.clamp((hipV - this.hipV) / Math.max(sdt, 1e-4), -80, 80);
    this.lastHipY = this.hips.position.y;
    this.hipV = hipV;
    const fresh = this.armSpring.length === 0;
    for (let h = 0; h < 2; h++) {
      const arm = this.arms[h];
      const el = this.elbows[h];
      if (fresh) {
        this.armSpring.push({ x: arm.rotation.x, vx: 0, z: arm.rotation.z, vz: 0, e: el.rotation.x, ve: 0 });
        continue;
      }
      const st = this.armSpring[h];
      st.vx += (accel * 0.06 + hipA * 0.3 * -Math.sin(st.x)) * sdt;
      const steps = Math.max(1, Math.ceil(sdt / (1 / 120)));
      const k = sdt / steps;
      for (let i = 0; i < steps; i++) {
        // stiff enough to keep up with the grab, loose enough to swing
        st.vx += (180 * (arm.rotation.x - st.x) - 2 * 0.58 * 13.4 * st.vx) * k;
        st.x += st.vx * k;
        st.vz += (180 * (arm.rotation.z - st.z) - 2 * 0.58 * 13.4 * st.vz) * k;
        st.z += st.vz * k;
        st.ve += (240 * (el.rotation.x - st.e) - 2 * 0.4 * 15.5 * st.ve) * k;
        st.e += st.ve * k;
      }
      arm.rotation.x = st.x;
      arm.rotation.z = st.z;
      el.rotation.x = st.e;
    }

    // The grab, over the top of all of it: the upper arms out wide and the
    // elbows folded UP, like something that holds its food, so the forearms
    // rise either side of his face and the long hands arrive at the edges of
    // whatever is in front of him, the fingers spread and hooked at the tips.
    const gb = this.grabNow;
    if (gb > 0.001) {
      for (let h = 0; h < 2; h++) {
        const out = h === 0 ? -1 : 1;
        const tw = Math.sin(this.breathT * 7 + h * 2) * 0.05;
        const arm = this.arms[h];
        arm.rotation.x += (0.3 + tw - arm.rotation.x) * gb;
        arm.rotation.z += (out * 1.15 - arm.rotation.z) * gb;
        const el = this.elbows[h];
        el.rotation.x += (-0.2 - el.rotation.x) * gb;
        // nothing else turns an elbow this way, so it is set, not blended
        el.rotation.z = out * 2.35 * gb;
        for (let f = 0; f < this.hands[h].length; f++) {
          const finger = this.hands[h][f];
          finger.rotation.x += ((f === 4 ? 0.2 : 0.22 + f * 0.05) + tw - finger.rotation.x) * gb;
        }
      }
    }

    // ---- HANDS ON THINGS.
    this.held[0] = 0;
    this.held[1] = 0;
    if (pose.hands) {
      for (let h = 0; h < 2; h++) {
        const goal = pose.hands[h];
        if (goal && goal.weight > 0.001) this.reachFor(h, goal);
      }
    }

    // ---- NEVER OVER HIS EYES.  From wherever you are looking at him from --
    // chasing you, or right in front of the lens at the end -- no part of an
    // arm or a hand is allowed across his eyes: the stare is the point, and
    // the arms frame it.  An arm that would cross them is swung out, and
    // eased back only once it is well clear.
    const viewer = pose.viewer ?? pose.reachAt ?? (this.grabNow > 0.01 ? this.gaze : null);
    this.keepEyesClear(viewer, dt);

    // ---- THE JAW.  Hinged too far back, so it drops a long way; and it
    // drops very slightly crooked, skewed to one side, which no jaw should.
    // Parted a crack while he searches, working, and wide once he has you.
    const m = this.mawNow;
    this.jaw.rotation.x = 0.012 + m * 0.44 + Math.max(0, Math.sin(this.breathT * 2.1)) * 0.012 * (0.4 + m);
    this.jaw.rotation.z = m * 0.07;
    this.jaw.rotation.y = m * 0.035;

    this.updateEyes(dt);
  }

  /**
   * Put a palm on `goal.at`: a two-bone solve, shoulder to elbow to palm, with
   * the elbow bowed out and back the way a long thin arm bends -- a spider's
   * leg, not a person's -- blended over the arm's own pose by `weight`.
   */
  private reachFor(h: number, goal: HandGoal): void {
    const out = h === 0 ? -1 : 1;
    const arm = this.arms[h];
    const elbow = this.elbows[h];
    const w = THREE.MathUtils.clamp(goal.weight, 0, 1);
    this.torso.updateWorldMatrix(true, false);
    const S = arm.position;
    const d = this.torso.worldToLocal(this.tmp.copy(goal.at)).sub(S);
    const A = 0.57; // shoulder to elbow
    const B = 0.66; // elbow to palm
    const len = THREE.MathUtils.clamp(d.length(), Math.abs(A - B) + 0.03, (A + B) * 0.995);
    const u = d.normalize();
    // where the elbow wants to go: out to the side, back, and a little up
    const pole = this.tmp2.set(out * 0.85, 0.25, -0.45);
    pole.addScaledVector(u, -pole.dot(u));
    if (pole.lengthSq() < 1e-6) pole.set(out, 0, 0).addScaledVector(u, -u.x * out);
    pole.normalize();
    const alpha = Math.acos(THREE.MathUtils.clamp((A * A + len * len - B * B) / (2 * A * len), -1, 1));
    const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((A * A + B * B - len * len) / (2 * A * B), -1, 1));
    // the upper arm
    const e = this.tmp3.copy(u).multiplyScalar(Math.cos(alpha)).addScaledVector(pole, Math.sin(alpha)).normalize();
    // the forearm, from the elbow to the palm
    const E = this.tmp4.copy(e).multiplyScalar(A);
    const f = this.tmp5.copy(u).multiplyScalar(len).sub(E).normalize();
    // rotate "hanging" onto the upper arm, then twist about it so the elbow's
    // bend (toward its local +z) is toward the forearm
    const q1 = this.q.setFromUnitVectors(this.tmp6.set(0, -1, 0), e);
    const zAxis = this.tmp6.set(0, 0, 1).applyQuaternion(q1);
    const fb = f.clone().addScaledVector(e, -f.dot(e));
    if (fb.lengthSq() > 1e-8) {
      fb.normalize();
      const ang = Math.atan2(zAxis.clone().cross(fb).dot(e), zAxis.dot(fb));
      q1.premultiply(this.q2.setFromAxisAngle(e, ang));
    }
    arm.quaternion.slerp(q1, w);
    elbow.rotation.x += (-bend - elbow.rotation.x) * w;
    elbow.rotation.z *= 1 - w;
    elbow.rotation.y = (goal.twist ?? 0) * w;
    // the fingers: spread as they come, closing round it
    for (let f2 = 0; f2 < this.hands[h].length; f2++) {
      const finger = this.hands[h][f2];
      const open = f2 === 4 ? 0.15 : 0.05 - f2 * 0.02;
      const shut = f2 === 4 ? 0.9 : 1.25 + f2 * 0.06;
      const want = open + (shut - open) * THREE.MathUtils.clamp(goal.grip, 0, 1);
      finger.rotation.x += (want - finger.rotation.x) * w;
    }
    this.held[h] = w;
  }

  /**
   * Swing each arm outward, as far as it needs, so that seen from `viewer`
   * nothing of it lies over either eye.  The swing is applied first and then
   * measured, and grows while there is still an overlap, so it finds the
   * smallest one that works and holds it.
   */
  private keepEyesClear(viewer: THREE.Vector3 | null, dt: number): void {
    for (let h = 0; h < 2; h++) {
      const out = h === 0 ? -1 : 1;
      if (!viewer) this.clear[h] = Math.max(0, this.clear[h] - dt * 1.5);
      // a hand that is holding something stays on it
      if (this.held[h] > 0.3) this.clear[h] = Math.max(0, this.clear[h] - dt * 4);
      this.arms[h].rotation.z += out * this.clear[h] * (1 - this.held[h]);
    }
    if (!viewer) return;
    this.root.updateMatrixWorld(true);
    // an eye, and a margin round it
    const rEye = 0.108 * 1.14 * this.size * 1.7;
    for (let e = 0; e < 2; e++) this.eyes[e].getWorldPosition(this.eyeW[e]);
    const p = this.tmp;
    const toEye = this.tmp2;
    const toP = this.tmp3;
    const test = (o: THREE.Object3D, y: number, worst: number): number => {
      o.localToWorld(p.set(0, -y, 0));
      toP.copy(p).sub(viewer);
      for (const eye of this.eyeW) {
        toEye.copy(eye).sub(viewer);
        const dist = toEye.length();
        // behind the eyes from here: the head hides it, it is not over them
        if (toP.length() >= dist) continue;
        worst = Math.min(worst, toP.angleTo(toEye) / Math.atan(rEye / dist));
      }
      return worst;
    };
    const measure = (h: number): number => {
      let worst = Infinity;
      // Sampled as finely as a limb this thin needs: at the old spacing a
      // forearm could pass between two samples and cross an eye for a frame.
      for (let y = 0.05; y <= 0.57; y += 0.06) worst = test(this.arms[h], y, worst);
      for (let y = 0; y <= 0.7; y += 0.05) worst = test(this.elbows[h], y, worst);
      for (const f of this.hands[h]) {
        for (let y = 0; y <= 0.26; y += 0.065) worst = test(f, y, worst);
      }
      return worst;
    };
    for (let h = 0; h < 2; h++) {
      const out = h === 0 ? -1 : 1;
      let worst = measure(h);
      // still over an eye: out further, now, in this frame -- a fast stroke
      // must not get one frame across his eyes before this catches it
      for (let i = 0; worst < 1 && this.clear[h] < 2.6 && i < 12 && this.held[h] < 0.3; i++) {
        this.clear[h] = Math.min(2.6, this.clear[h] + 0.22);
        this.arms[h].rotation.z += out * 0.22;
        this.arms[h].updateMatrixWorld(true);
        worst = measure(h);
      }
      if (worst > 1.4) this.clear[h] = Math.max(0, this.clear[h] - dt * 1.2);
    }
  }

  /**
   * THE EYES.  They dart on their own every second or two -- small, quick,
   * and then still -- and when he has something to look at, they go to it
   * and stay there.  Public so a caller that moves him after `update` (the
   * jumpscare, which puts his face in front of the camera) can re-aim them.
   */
  updateEyes(dt: number): void {
    this.saccadeIn -= dt;
    if (this.saccadeIn <= 0) {
      this.saccadeIn = 0.6 + Math.random() * 1.8;
      this.saccade.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.18);
    }
    this.root.updateMatrixWorld(true);
    for (const eye of this.eyes) {
      let yaw = this.saccade.x;
      let pitch = this.saccade.y;
      if (this.gaze) {
        const local = eye.parent!.worldToLocal(this.gaze.clone());
        local.sub(eye.position);
        yaw = Math.atan2(local.x, local.z) + this.saccade.x * 0.15;
        pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z)) + this.saccade.y * 0.15;
      }
      eye.rotation.y += (THREE.MathUtils.clamp(yaw, -0.6, 0.6) - eye.rotation.y) * Math.min(1, dt * 22);
      eye.rotation.x += (THREE.MathUtils.clamp(pitch, -0.5, 0.5) - eye.rotation.x) * Math.min(1, dt * 22);
    }
  }
}
