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
    const chest = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.15, 22, 18), 0.006, 7, 41), skin);
    chest.scale.set(0.98, 1.55, 0.78);
    chest.position.set(0, 0.47, 0);
    this.torso.add(chest);
    this.chest = chest;
    // the ribs: one arc a side per rib, down the front of the cage, parted at
    // the breastbone, flaring outward toward the bottom where the belly sinks
    for (let k = 0; k < 7; k++) {
      const y = 0.58 - k * 0.042;
      const w = 0.135 + Math.sin((k / 6) * Math.PI) * 0.02 + k * 0.003;
      for (const side of [-1, 1]) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(w, 0.0062, 5, 18, Math.PI * 0.42), skinPale);
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = side > 0 ? -0.18 : Math.PI - Math.PI * 0.42 + 0.18;
        arc.scale.set(1, 0.78, 1);
        arc.position.set(0, y - (side > 0 ? 0 : 0), 0.005);
        // tilt: the front of each rib runs down toward the breastbone
        arc.rotateOnAxis(new THREE.Vector3(side, 0, 0), 0.2);
        this.torso.add(arc);
      }
    }
    this.torso.add(strut(new THREE.Vector3(0, 0.62, 0.108), new THREE.Vector3(0, 0.38, 0.1), 0.012, skinPale));
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
      arm.add(bone(0.034, 0.41, 1.1, 0.8, skin, 55 + side));
      const elbow = new THREE.Group();
      elbow.position.y = -0.48;
      arm.add(elbow);
      elbow.add(knob(0.029, skin, 57 + side));
      elbow.add(bone(0.028, 0.41, 1.05, 0.62, skin, 59 + side));
      // what is left of the forearm muscle, just below the elbow
      const fore = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.03, 0.14, 6, 12), 1.05, 0.55), 0.003, 10, 60 + side), skin);
      fore.position.set(side * 0.006, -0.12, 0.008);
      elbow.add(fore);
      const wrist = knob(0.02, skin, 61 + side);
      wrist.position.y = -0.48;
      elbow.add(wrist);
      const palm = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.04, 12, 10), 0.003, 12, 63 + side), skin);
      palm.scale.set(0.95, 1.5, 0.42);
      palm.position.set(0, -0.54, 0);
      elbow.add(palm);
      const hand: THREE.Group[] = [];
      for (let f = 0; f < 5; f++) {
        const thumb = f === 4;
        const finger = new THREE.Group();
        finger.position.set(thumb ? 0 : (f - 1.5) * 0.017, thumb ? -0.52 : -0.59, thumb ? 0.03 : 0);
        if (thumb) finger.rotation.set(0.4, 0, side * 0.5);
        const L1 = thumb ? 0.08 : 0.12 - Math.abs(f - 1.5) * 0.012;
        const L2 = thumb ? 0.06 : 0.1 - Math.abs(f - 1.5) * 0.01;
        finger.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L1, 0.004), 0.0085, skin));
        const k1 = knob(0.0095, skin, 67 + f);
        k1.position.set(0, -L1, 0.004);
        finger.add(k1);
        const tipSeg = new THREE.Group();
        tipSeg.position.set(0, -L1, 0.004);
        tipSeg.rotation.x = 0.18;
        tipSeg.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L2, 0), 0.0072, skin));
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
    const snout = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.2, 26, 20), 0.004, 7, 83), muzzle);
    snout.scale.set(1.12, 0.66, 0.78);
    snout.position.set(0, -0.045, 0.085);
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

    // ---- THE MOUTH.  The mascot's wide line, cut into the muzzle, and a
    // lower jaw hinged at the back that hardly moves -- until it does.
    // No mouth drawn on it.  The mascot's grin was the one friendly line on
    // the face, and a face with no mouth at all is the one that watches.  The
    // jaw below parts when it needs to, onto the dark inside.
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), flat(MOUTH));
    throat.scale.set(1.3, 0.35, 0.9);
    throat.position.set(0, -0.1, 0.08);
    this.head.add(throat);
    this.jaw.position.set(0, -0.08, -0.04);
    const chin = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.18, 22, 14, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0.004, 8, 97), muzzle);
    chin.scale.set(1.12, 0.62, 0.78);
    chin.position.set(0, 0.0, 0.12);
    this.jaw.add(chin);
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
      // the long fingers hang a little curled, and curl shut on the grab
      for (let f = 0; f < this.hands[h].length; f++) {
        const finger = this.hands[h][f];
        const idle = 0.12 + Math.sin(this.breathT * 0.9 + f * 1.3 + h) * 0.05;
        finger.rotation.x = (f === 4 ? 0.4 : 0) + idle + reach * (0.15 + 0.95 * (1 - g));
      }
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
        arm.rotation.z += (out * 1.3 - arm.rotation.z) * gb;
        const el = this.elbows[h];
        el.rotation.x += (-0.2 - el.rotation.x) * gb;
        // nothing else turns an elbow this way, so it is set, not blended
        el.rotation.z = out * 1.9 * gb;
        for (let f = 0; f < this.hands[h].length; f++) {
          const finger = this.hands[h][f];
          finger.rotation.x += ((f === 4 ? 0.2 : 0.22 + f * 0.05) + tw - finger.rotation.x) * gb;
        }
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
    const dip = (1 - Math.abs(Math.cos(phase))) * Math.min(0.09, 0.02 + speed * 0.018) * moving;
    const breath = Math.sin(this.breathT * 1.5) * 0.01;
    // And the hips come down by what the fold costs: on the long legs, 0.64
    // of a 1.02 hip puts his face at about the height of the gap under a bed,
    // which is the whole point of the pose.
    this.hips.position.y = dip + breath + crest * 0.12 - cr * 0.64;
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
    this.hips.rotation.z = gait * 0.035 * moving;

    // Folded forward, further the faster he moves, and further again once he is
    // coming for you.  A climb folds him over whatever he is on top of.
    // Upright, with a stoop that never straightens: he is too tall for every
    // room he is in.  Faster and hunting, the stoop deepens into a prowl.
    this.torso.rotation.x =
      0.14 + Math.min(0.2, speed * 0.05) + this.climbNow * 0.45 + this.lungeNow * 0.3 +
      cr * 0.62;
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
      -0.04 - Math.min(0.16, speed * 0.04) - this.climbNow * 0.2 - this.lungeNow * 0.26 +
      cr * 0.5;
    // Craning: slow, small, side to side, and offset from the body's own sway
    // so the two never line up into something that looks mechanical.
    this.neck.rotation.y = this.scanNow + twitch + Math.sin(this.breathT * 1.9) * 0.3 * peer;
    // and the head cocks: slowly over to one side and back, the way a thing
    // does that is listening for you
    this.neck.rotation.z =
      -gait * 0.05 + twitch * 0.4 + Math.sin(this.breathT * 1.3 + 1.1) * 0.16 * peer +
      Math.sin(this.breathT * 0.37) * 0.09;

    // The arms come FORWARD and down to take his weight on the floor.  The
    // sign matters and it is not the legs': on an arm hanging from a shoulder,
    // negative rotation.x is the way the climb reach goes, which is forward --
    // positive swung both of them out behind him like oars.
    if (cr > 0.001) {
      for (const arm of this.arms) arm.rotation.x -= cr * 0.55;
      for (const el of this.elbows) el.rotation.x -= cr * 0.3;
    }

    // The jaw.  Barely parted, working very slightly, and dropping open only
    // as far as the mascot's mouth could -- which is not far, and is worse.
    this.jaw.rotation.x = 0.02 + this.mawNow * 0.34 + Math.max(0, Math.sin(this.breathT * 2.1)) * 0.012;

    this.updateEyes(dt);
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
