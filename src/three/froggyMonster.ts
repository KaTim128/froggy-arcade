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
const MUZZLE = 0x4a4743;
const MOUTH = 0x030202;
/** The lids: the face's own skin, a shade darker, not a black cap. */
const LID = 0x312d2a;
/**
 * The whites.  A dirty grey-white rather than white: a pure white eye under a
 * torch is a lamp, and a lamp is not looking at you.
 */
const SCLERA = 0x807b73;
const PUPIL = 0x020202;
/** The lips: the face's grey, darker and wetter, with a little blood in it. */
const LIP = 0x342d2b;
const MOUTH_WET = 0x080303;
/** Old ivory gone yellow-grey. */
/**
 * Old ivory, yellowed, one or two nearly brown -- but LIGHT: they were dark
 * enough to vanish into the mouth they sat in, and the teeth are the scare.
 */
const TOOTH = [0xcfc3a0, 0xbdb08a, 0xd9ceae, 0xa89c78];
/** The gums: raw, dark, wet. */
const GUM = 0x44101a;
/** The mouth's rim, in the head's own units. */
const MOUTH_Y = -0.1;
const MOUTH_Z = 0.085;
/**
 * Half its width: wider than the muzzle was, and a touch wider than the head
 * -- but the corners end IN the face, sunk into the jowls (below), never
 * standing out past the cheeks in the air.
 */
const MOUTH_W = 0.27;
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
  // BLOODSHOT: a raw pink-red flush creeping in from the rim, under the veins
  const flush = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.6);
  flush.addColorStop(0, 'rgba(150,40,36,0)');
  flush.addColorStop(0.55, 'rgba(150,40,36,0.16)');
  flush.addColorStop(1, 'rgba(120,20,22,0.42)');
  ctx.fillStyle = flush;
  ctx.fillRect(0, 0, W, H);
  // the veins: from the rim (y ~ 0.55H) up toward the middle, branching
  const vein = (x: number, y: number, len: number, w: number, depth: number): void => {
    ctx.strokeStyle = `rgba(${150 + rnd() * 50},${22 + rnd() * 20},${24 + rnd() * 16},${0.55 + rnd() * 0.35})`;
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
  // many more of them than a healthy eye has, and thicker at the rim
  for (let i = 0; i < 70; i++) vein(rnd() * W, H * (0.5 + rnd() * 0.12), 12 + rnd() * 30, 0.7 + rnd() * 1.1, 2);
  // and a few burst ones: a spot of blood in the white
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(130,14,16,${0.25 + rnd() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * W, H * (0.3 + rnd() * 0.22), 2 + rnd() * 5, 1 + rnd() * 2.5, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  scleraTex = new THREE.CanvasTexture(c);
  scleraTex.colorSpace = THREE.SRGBColorSpace;
  scleraTex.wrapS = THREE.RepeatWrapping;
  return scleraTex;
}

/** The eyeball's radius, and the pupil's angular size shut down and blown. */
const EYE_R = 0.108;
const PUPIL_MIN = 0.125;
const PUPIL_MAX = 0.4;
const PUPIL_STEPS = 12;
/**
 * A pupil shrunk to a pinprick: the predatory stare of the scares.  Round
 * and small, but not a needle -- at 0.04 it vanished on the white at any
 * distance and read as a scratch up close.  Two and a half times that is
 * still tight, still wrong, and a hard black dot from across a dark room.
 */
const PUPIL_PIN = 0.1;
const pupilGeoms: THREE.BufferGeometry[] = [];
const pinGeoms: THREE.BufferGeometry[] = [];
const ringGeoms: THREE.BufferGeometry[] = [];
/**
 * The pupil at constriction `c` (0..1), from its resting size down to a
 * pinprick, and the thin ring of iris that is all that shows round it --
 * without the ring a pinprick on a white eye at the length of a room is
 * nothing at all; with it, it is a stare.
 */
function pinCap(c: number): { pupil: THREE.BufferGeometry; ring: THREE.BufferGeometry } {
  const i = Math.round(THREE.MathUtils.clamp(c, 0, 1) * PUPIL_STEPS);
  if (!pinGeoms[i]) {
    const theta = PUPIL_MIN + (PUPIL_PIN - PUPIL_MIN) * (i / PUPIL_STEPS);
    const g = new THREE.SphereGeometry(EYE_R * 1.012, 20, 3, 0, Math.PI * 2, 0, theta);
    g.rotateX(Math.PI / 2);
    pinGeoms[i] = g;
    // a thin rim of dark iris round it, not a bright ring: a yellow halo
    // read as a cartoon eye
    const r = new THREE.SphereGeometry(EYE_R * 1.009, 24, 2, 0, Math.PI * 2, theta, 0.045);
    r.rotateX(Math.PI / 2);
    ringGeoms[i] = r;
  }
  return { pupil: pinGeoms[i], ring: ringGeoms[i] };
}
/**
 * The pupil at dilation `k` (0..1): a cap of a sphere just outside the eye,
 * facing +z.  Built once per step and shared between every Froggy, so opening
 * the pupils costs a geometry swap, not a rebuild.
 */
function pupilCap(k: number): THREE.BufferGeometry {
  const i = Math.round(THREE.MathUtils.clamp(k, 0, 1) * PUPIL_STEPS);
  if (!pupilGeoms[i]) {
    const theta = PUPIL_MIN + (PUPIL_MAX - PUPIL_MIN) * (i / PUPIL_STEPS);
    const g = new THREE.SphereGeometry(EYE_R * 1.012, 24, 4, 0, Math.PI * 2, 0, theta);
    g.rotateX(Math.PI / 2);
    pupilGeoms[i] = g;
  }
  return pupilGeoms[i];
}

/**
 * SPIT.  Strings of it between the lips that stretch as the jaw goes and
 * snap when it goes too far, and a drop that swells at the corner of the
 * mouth until it is heavy enough to fall.  Everything is in the head's own
 * space: the upper ends are fixed to it, the lower ends ride the jaw.
 */
class Drool {
  private strands: {
    top: THREE.Vector3;
    bottom: THREE.Vector3;
    max: number;
    r: number;
    seg: [THREE.Mesh, THREE.Mesh];
    broken: boolean;
  }[] = [];
  private drop: THREE.Mesh;
  private dropFrom: THREE.Vector3;
  private dropT = 0;
  private dropFall = -1;
  private dropFallAt = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    head: THREE.Object3D,
    private jaw: THREE.Object3D,
    ends: { top: THREE.Vector3; bottom: THREE.Vector3 }[],
    dropFrom: THREE.Vector3,
  ) {
    const mat = new THREE.MeshPhongMaterial({
      color: 0x8d8f82,
      specular: 0xffffff,
      shininess: 140,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const tube = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    ends.forEach((e, i) => {
      const seg: [THREE.Mesh, THREE.Mesh] = [new THREE.Mesh(tube, mat), new THREE.Mesh(tube, mat)];
      for (const s of seg) {
        s.visible = false;
        head.add(s);
      }
      this.strands.push({ ...e, max: 0.07 + ((i * 37) % 11) * 0.009, r: 0.0022 + (i % 3) * 0.0008, seg, broken: false });
    });
    const dg = new THREE.SphereGeometry(1, 8, 6);
    dg.translate(0, -1, 0);
    this.drop = new THREE.Mesh(dg, mat);
    this.drop.visible = false;
    head.add(this.drop);
    this.dropFrom = dropFrom;
  }

  private place(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, r: number): void {
    this.dir.subVectors(to, from);
    const len = this.dir.length();
    if (len < 1e-5) {
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.addVectors(from, to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(this.up, this.dir.multiplyScalar(1 / len));
    m.scale.set(r, len, r);
  }

  update(dt: number, maw: number): void {
    this.jaw.updateMatrix();
    for (const s of this.strands) {
      this.a.copy(s.top);
      this.b.copy(s.bottom).applyMatrix4(this.jaw.matrix);
      const gap = this.a.distanceTo(this.b);
      // shut, the lips are together and the string reforms between them
      if (gap < 0.014) s.broken = false;
      if (gap > s.max) s.broken = true;
      if (s.broken || gap < 0.008) {
        s.seg[0].visible = false;
        s.seg[1].visible = false;
        continue;
      }
      // it sags under its own weight, and thins as it is drawn out
      this.mid.addVectors(this.a, this.b).multiplyScalar(0.5);
      this.mid.y -= 0.004 + gap * 0.28;
      const r = s.r * Math.sqrt(0.02 / Math.max(0.02, gap));
      this.place(s.seg[0], this.a, this.mid, r);
      this.place(s.seg[1], this.mid, this.b, r * 0.85);
    }

    // The drop at the corner: swelling -- faster with the mouth open -- and
    // then gone, falling away.
    const d = this.drop;
    if (this.dropFall >= 0) {
      this.dropFall += dt;
      d.position.copy(this.dropFallAt);
      d.position.y -= 0.5 * 9.8 * 0.25 * this.dropFall * this.dropFall;
      d.scale.set(0.006, 0.012, 0.006);
      if (this.dropFall > 0.45) {
        this.dropFall = -1;
        this.dropT = 0;
        d.visible = false;
      }
      return;
    }
    this.dropT += dt * (0.25 + maw * 0.9);
    const k = Math.min(1, this.dropT / 2.4);
    d.visible = k > 0.05;
    d.position.copy(this.dropFrom).applyMatrix4(this.jaw.matrix);
    d.scale.set(0.004 + k * 0.003, 0.006 + k * k * 0.03, 0.004 + k * 0.003);
    if (k >= 1) {
      this.dropFall = 0;
      this.dropFallAt.copy(d.position);
      this.dropFallAt.y -= d.scale.y;
    }
  }
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
// (ankle to floor: the foot and the toes under it are this deep; at 0.07 the
// soles went a few centimetres into the floor on every planted step)
const SOLE = 0.095;
/** Where the hip joints are built, over the soles, in model units. */
const HIP_Y = 1.02;
/** Ankle to the tips of the toes, forward: how far they drop as the foot points. */
const TOE_REACH = 0.31;
/**
 * Hip joint over the ankle, squatting, in model units: the knees folded right
 * up, and on these legs his face at about the height of the gap under a bed.
 */
const SQUAT_HIP = 0.31;

/** Head to floor, in metres, standing, before the room's own scale. */
export const FROGGY_HEIGHT = 2.1;

export interface FroggyPose {
  /** Metres per second he is actually covering.  Drives the walk cycle. */
  speed: number;
  /** 0..1 mouth openness.  Chasing opens it. */
  maw: number;
  /** 0..1 going over something.  What his body does is `climbRig`'s. */
  climb: number;
  /**
   * Going over something, placed limb by limb (see froggyClimb): how high his
   * hips are, how far he is folded, and where each foot is, in the world.
   * `k` blends it over the walk.  The hands go in `hands`, like any other
   * hand on anything.
   */
  climbRig?: ClimbRig | null;
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
   * 0..1 his pupils: a pinprick while he hunts, blown wide and black when he
   * has you.  Eased, so it opens over a moment rather than snapping.
   */
  dilate?: number;
  /**
   * 0..1 his teeth bared: the jaw drops further than `maw` alone takes it
   * and the teeth push out of the gums -- the chase and the attack.
   */
  bare?: number;
  /**
   * 0..1 the other way: his pupils shrinking to a pinprick inside a thin ring
   * of sickly iris, and the lids pulled right back -- the fixed, predatory
   * stare of the key room, the jumpscare and the chase.  Wins over `dilate`.
   */
  constrict?: number;
  /**
   * 0..1 his head going down into a gap to look in: dipped, and rolled over
   * on its side much further than a neck should go, so one eye comes into
   * the gap before the rest of the face.
   */
  peek?: number;
  /**
   * 0..1 perfectly still: no twitch, no darting eyes, no idle working of the
   * jaw or cock of the head, no blinking.  A thing that has seen you and is
   * doing nothing but looking.
   */
  still?: number;
  /** 0..1 shoulders rounded and the head pushed forward on its neck, arms hanging dead. */
  hunch?: number;
  /** Radians the head is tipped over to one side. */
  tilt?: number;
  /** 0..1 the jaw going further than a jaw goes: dropped and stretched long. */
  stretch?: number;
  /**
   * 0..1 the scream itself, at full voice: the arms come up off his sides
   * with the claws out, the back comes over you and the head is thrown at
   * you.  See the warning in `update`.
   */
  rage?: number;
  /**
   * World height of the floor under him.  Nothing of him goes below it: not
   * a foot in a squat, not an elbow on all fours, not an eye with his face
   * down at a gap.  Leave it out and it is where his feet are.
   */
  floor?: number;
  /**
   * The solid things round him, as world boxes.  His head and his chest stay
   * out of them -- he leans in to a bed or a locker as far as it lets him and
   * no further -- and his hands, which are meant to touch them, are left
   * alone.  Leave it out and nothing is checked.
   */
  solids?: Solid[] | null;
  /**
   * Somewhere his FACE goes to, not just his eyes: the neck turns the head
   * onto it (the gap under a bed, the inside of a locker), `faceK` of the
   * way.  The roll a `peek` puts on the head stays on top.
   */
  faceTo?: THREE.Vector3 | null;
  faceK?: number;
  /**
   * 0..1 the last lunge: the arms and fingers drawn out long -- a third as
   * long again, the fingers half again -- and held up and forward like
   * something about to drop on you.  The hands go where `hands` puts them.
   */
  pounce?: number;
  /**
   * 0..1 THE WARNING.  Not coming for you -- braced to.  The shoulders come
   * up round the neck, the back comes over you, the arms come off his sides
   * bent and ready with the long fingers working open and shut, and all of it
   * shakes very slightly with the effort of not.  He stays where he is.
   */
  menace?: number;
}

/** A solid box in the world, axis-aligned, from the floor up to `y1`. */
export interface Solid {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y1: number;
  /** Where it starts off the floor, if not at it. */
  y0?: number;
}

export interface ClimbRig {
  k: number;
  /** World height of his hip joints over the floor. */
  hip: number;
  pitch: number;
  roll: number;
  /** World height of the top he is going over: the fingers lie on it, not in it. */
  top: number;
  /** [left, right], in the world: the sole goes here. */
  feet: [THREE.Vector3, THREE.Vector3];
  /** [left, right] 0..1 hanging in the air rather than standing on anything: the toes point down. */
  hang?: [number, number];
  /** The S-curve: the shoulders wrung round (+ to his right), and the pulling one dropped. */
  twist?: number;
  drop?: number;
  /** 0..1 straining on the haul: a tremble through the back and arms. */
  strain?: number;
  /** Knees out, radians. */
  splay?: number;
}

export interface HandGoal {
  at: THREE.Vector3;
  weight: number;
  grip: number;
  twist?: number;
  /**
   * Which way the elbow goes, in the world, when it should not bow out to
   * the side as it does by default -- an arm in a tight space keeps its
   * elbow down and in.
   */
  pole?: THREE.Vector3;
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
  /** Each eye's lids: hinged at the eye's centre, following it, closing to blink. */
  private lids: { group: THREE.Group; upper: THREE.Group; lower: THREE.Group }[] = [];
  private pupils: THREE.Mesh[] = [];
  /** 0 pinpoint .. 1 blown wide: fear, or the moment he has you. */
  private dilateNow = 0;
  private dilateWant = 0;
  private constrictNow = 0;
  private constrictWant = 0;
  private pinLevel = -1;
  private rings: THREE.Mesh[] = [];
  private pupilLevel = -1;
  private blinkIn = 2.5;
  private blinkT = -1;
  /** The swallow: a slow bob of the throat, now and then. */
  private swallowIn = 4;
  private swallowT = -1;
  private apple: THREE.Object3D | null = null;
  private drool: Drool | null = null;
  /** Drawn in a little while the mouth is shut, so they stay inside it. */
  private upperTeeth: THREE.Mesh[] = [];
  private allTeeth: THREE.Mesh[] = [];
  /** 0..1 teeth bared: the jaw further down and every tooth out to its full length and more. */
  private bareNow = 0;
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
  /** The current twitch: where the head snapped to, held and then let go. */
  private readonly twitchTo = new THREE.Vector3();
  private twitchHold = 0;
  private stillNow = 0;
  private hunchNow = 0;
  private tiltNow = 0;
  private menaceNow = 0;
  private rageNow = 0;
  /**
   * WHO HE IS TONIGHT.  Small, consistent differences picked once per
   * appearance (see `vary`) so he is never quite the same figure twice: how
   * far he stoops, which way his head sits, how far his arms hang from his
   * sides, one eye bigger than the other.
   */
  private varHunch = 0;
  private varTilt = 0;
  private varSplay = 0;
  private neckBaseY = NaN;
  private stretchNow = 0;
  private pounceNow = 0;
  private armSkin: THREE.MeshPhongMaterial | null = null;
  /** World height of the floor this frame.  See FroggyPose.floor. */
  private floorY = 0;
  /** World units per model unit, parents and all. */
  private sizeW = 1;
  /** How far his face is turned onto `faceTo`, eased, and where that is. */
  private faceNow = 0;
  private readonly faceAtV = new THREE.Vector3();
  /**
   * Points on the surface of his head, jaw, neck and trunk, each in its own
   * part's space: what `unclip` keeps out of the floor and out of things.
   */
  private clipPts: { o: THREE.Object3D; p: THREE.Vector3; shell: number }[] = [];
  private clipShells = 0;
  /** Where each shape's points start and end in `clipPts` (they are pushed together). */
  private readonly clipRange: [number, number][] = [];
  /** How many of the points, from the start, are ones the floor is tested against. */
  private clipFloorPts = 0;
  private readonly clipW = new THREE.Vector3();
  private readonly clipLoc: THREE.Vector3[] = [];
  /**
   * The parts of each arm that are drawn out for the pounce, and where they
   * were built, so the length can be set from the rest length every frame.
   */
  private armLen: {
    upper: THREE.Object3D;
    upperY: number;
    fore: THREE.Object3D[];
    foreY: number[];
    hand: THREE.Object3D[];
    handY: number[];
  }[] = [];
  /** How long the arms are this frame, and the fingers, x their rest length. */
  private armK = 1;
  private fingerK = 1;
  private scleraMats: THREE.MeshPhongMaterial[] = [];
  private toothMats: THREE.MeshPhongMaterial[] = [];
  private lowerJaw: THREE.Group | null = null;
  /** The back and sides of the mouth: a dark wall that deepens as the jaw drops. */
  private cavity: THREE.Mesh | null = null;
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
    // the lids are open shells: their undersides show at the edge
    lidMat.side = THREE.DoubleSide;
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
    const HIP = HIP_Y;

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
    // (Their own copy of the skin -- the same shader, so nothing new to
    // build -- so the pounce can put a cold sheen on them alone.)
    const armSkin = skin.clone();
    this.armSkin = armSkin;
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.18, SH - 0.03, 0);
      arm.rotation.z = side * 0.06;
      // Far longer than any person's: the elbow comes level with his hip
      // and the fingertips hang to the middle of his shins.
      // (Thin, but not sticks: a shoulder of muscle wasted down to a cord at
      // the elbow, a forearm with its two bones showing, a real wrist.)
      const upper = bone(0.038, 0.5, 1.15, 0.72, armSkin, 55 + side);
      arm.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.57;
      arm.add(elbow);
      elbow.add(knob(0.032, armSkin, 57 + side));
      const foreBone = bone(0.03, 0.5, 1.05, 0.68, armSkin, 59 + side);
      elbow.add(foreBone);
      // what is left of the forearm muscle, just below the elbow
      const fore = new THREE.Mesh(lumpy(taper(new THREE.CapsuleGeometry(0.037, 0.2, 6, 12), 1.05, 0.55), 0.003, 10, 60 + side), armSkin);
      fore.position.set(side * 0.006, -0.15, 0.008);
      elbow.add(fore);
      const handFrom = elbow.children.length;
      const wrist = knob(0.026, armSkin, 61 + side);
      wrist.scale.set(1.25, 1, 0.8);
      wrist.position.y = -0.57;
      elbow.add(wrist);
      // a broad, flat palm with the knuckles standing up along its end
      const palm = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.046, 14, 12), 0.003, 12, 63 + side), armSkin);
      palm.scale.set(1.15, 1.35, 0.45);
      palm.position.set(0, -0.64, 0);
      elbow.add(palm);
      for (let f = 0; f < 4; f++) {
        const kn = knob(0.013, armSkin, 80 + f + side * 7);
        kn.position.set((f - 1.5) * 0.021, -0.684, -0.004);
        elbow.add(kn);
      }
      const hand: THREE.Group[] = [];
      for (let f = 0; f < 5; f++) {
        const thumb = f === 4;
        const finger = new THREE.Group();
        finger.position.set(thumb ? side * 0.03 : (f - 1.5) * 0.021, thumb ? -0.62 : -0.69, thumb ? 0.026 : 0);
        if (thumb) finger.rotation.set(0.4, 0, side * 0.5);
        const L1 = thumb ? 0.085 : 0.14 - Math.abs(f - 1.5) * 0.012;
        const L2 = thumb ? 0.065 : 0.12 - Math.abs(f - 1.5) * 0.01;
        finger.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L1, 0.004), 0.0115, armSkin));
        const k1 = knob(0.0125, armSkin, 67 + f);
        k1.position.set(0, -L1, 0.004);
        finger.add(k1);
        const tipSeg = new THREE.Group();
        tipSeg.position.set(0, -L1, 0.004);
        tipSeg.rotation.x = 0.18;
        tipSeg.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L2, 0), 0.0095, armSkin));
        // and a frog's round pad on the end of every one
        const pad = knob(0.0155, armSkin, 74 + f);
        pad.scale.set(1.1, 0.8, 0.75);
        pad.position.set(0, -L2 - 0.004, 0.002);
        tipSeg.add(pad);
        finger.add(tipSeg);
        elbow.add(finger);
        hand.push(finger);
      }
      this.hands.push(hand);
      // everything from the wrist down moves down the forearm as it lengthens
      const handParts = elbow.children.slice(handFrom);
      this.armLen.push({
        upper,
        upperY: upper.position.y,
        fore: [foreBone, fore],
        foreY: [foreBone.position.y, fore.position.y],
        hand: handParts,
        handY: handParts.map((o) => o.position.y),
      });
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
    this.apple = apple;

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
    // The dark round each eye: a sunken ring of shadow the lids sit in, so
    // the whites come out of black rather than out of grey skin.
    const hollow = new THREE.MeshLambertMaterial({ color: 0x070505 });
    for (const side of [-1, 1]) {
      const ex = side * 0.138;
      // NOT A PAIR.  The right eye a little bigger and a little lower than the
      // left: nothing anyone notices, and the face stops being a mask.
      const ey = side > 0 ? 0.138 : 0.15;
      const ez = 0.075;
      const eyeK = side > 0 ? 1.06 : 1;
      const socket = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.122, 20, 16), 0.004, 9, 87 + side), face);
      socket.position.set(ex, ey - 0.014, ez - 0.05);
      this.head.add(socket);
      const eye = new THREE.Group();
      eye.position.set(ex, ey, ez + 0.012);
      eye.scale.setScalar(eyeK);
      this.head.add(eye);
      const shade = new THREE.Mesh(new THREE.TorusGeometry(0.122 * eyeK, 0.022, 8, 30), hollow);
      shade.position.set(ex, ey - 0.004, ez - 0.012);
      this.head.add(shade);
      // fine veins creeping in from the rim, painted on, thin enough to be
      // seen only up close -- which is where you will be
      // Wet, with a tight hard highlight; and very faintly lit from inside,
      // so in the dark the two whites are the last thing to go.
      const scleraMat = new THREE.MeshPhongMaterial({
        color: SCLERA,
        map: sclera(),
        specular: 0x6a665c,
        shininess: 110,
        emissive: 0x3a2c26,
        emissiveMap: sclera(),
        emissiveIntensity: 0.55,
      });
      this.scleraMats.push(scleraMat);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.108, 28, 20), scleraMat);
      white.rotation.x = Math.PI / 2;
      white.rotation.y = side * 0.7;
      white.name = 'sclera';
      eye.add(white);
      // The pupil is a patch OF the eyeball -- a cap a hair proud of the
      // white -- rather than a bead stuck on it, so it can open from a
      // pinprick to most of the front of the eye and stay on the surface.
      const pupil = new THREE.Mesh(pupilCap(0), flat(PUPIL));
      pupil.name = 'pupil';
      eye.add(pupil);
      this.pupils.push(pupil);
      // the iris ring round a constricted pupil: hidden until he stares
      const ring = new THREE.Mesh(pinCap(0).ring, flat(0x2e1a0c));
      ring.visible = false;
      eye.add(ring);
      this.rings.push(ring);
      this.eyes.push(eye);
      // THE LIDS: an upper and a lower, each a shell of skin just proud of
      // the eyeball and hinged at its centre, so they ride over it rather
      // than through it.  They follow the eye -- look down and the upper lid
      // comes down with it, look up and it lifts -- which is what a real lid
      // does and a painted one does not, and they close together to blink.
      // Open, the upper one sits low over the top of the iris-less white, and
      // a thick wet rim runs along the edge of each.
      const lids = new THREE.Group();
      lids.position.copy(eye.position);
      lids.scale.setScalar(eyeK);
      this.head.add(lids);
      const upper = new THREE.Group();
      // the top half of a sphere round the eye, its open edge level with the
      // pupil; the hinge rotation about x lifts that edge or lowers it
      const upperShell = new THREE.Mesh(new THREE.SphereGeometry(0.116, 26, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), lidMat);
      upper.add(upperShell);
      // the rim along its edge: the front half of a ring laid on that edge
      const upperEdge = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.0115, 8, 30, Math.PI), lidMat);
      upperEdge.rotation.x = Math.PI / 2;
      upper.add(upperEdge);
      lids.add(upper);
      const lower = new THREE.Group();
      const lowerShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 26, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        lidMat,
      );
      lower.add(lowerShell);
      const lowerEdge = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.009, 8, 30, Math.PI), lidMat);
      lowerEdge.rotation.x = Math.PI / 2;
      lower.add(lowerEdge);
      lids.add(lower);
      this.lids.push({ group: lids, upper, lower });
      // and a rim of socket round the lot, so it sits IN the head
      const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.009, 6, 28), lidMat);
      lidRim.position.set(ex, ey, ez - 0.02);
      this.head.add(lidRim);
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
    // Dark and wet: it glistens where light gets in and is black everywhere else.
    const wet = new THREE.MeshPhongMaterial({ color: MOUTH_WET, specular: 0x120807, shininess: 60 });
    // Wet enamel: a small hard highlight on every one, and a trace of their
    // own light so a mouthful of them still reads in the dark.
    const toothMats = TOOTH.map(
      (color) => new THREE.MeshPhongMaterial({ color, specular: 0x8c8672, shininess: 95, emissive: 0x17130c, emissiveIntensity: 1 }),
    );
    this.toothMats = toothMats;
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
        // corner to corner, and no further: run on past them (as it once did,
        // back toward the hinge) the lip stood out from the side of the face
        // on its own, a seam with nothing behind it
        const a = -0.12 + (i / 24) * (Math.PI + 0.24);
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
    // THE INSIDE OF THE MOUTH.  A curved wall round the back and sides of it,
    // from the roof down, as deep as the jaw is open -- so however far the
    // jaw goes there is dark behind the teeth and never the neck and chest
    // showing through the gap.
    //
    // It is a rounded pouch -- the back half of a ball, hung from the roof of
    // the mouth -- so it has no straight edges to read as a box behind the
    // teeth, and it is flesh, not paint: a dark wet red at the lips going down
    // to black at the back of the throat, so the open mouth reads as a mouth.
    {
      const g = new THREE.SphereGeometry(1, 28, 16, Math.PI * 0.3, Math.PI * 1.4);
      g.translate(0, -1, 0);
      const pos = g.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const lip = new THREE.Color(0x4a0e14);
      const deep = new THREE.Color(0x070102);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        // front (toward the lips) and high is flesh; back and down is the dark
        const front = THREE.MathUtils.clamp((pos.getZ(i) + 1) / 1.9, 0, 1);
        const high = THREE.MathUtils.clamp(1 + pos.getY(i) / 2, 0, 1);
        c.copy(deep).lerp(lip, front * front * (0.45 + 0.55 * high));
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const cav = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      cav.position.set(0, MOUTH_Y + 0.004, MOUTH_Z - 0.01);
      cav.scale.set(MOUTH_W * 0.9, 0.001, MOUTH_D * 0.9);
      this.head.add(cav);
      this.cavity = cav;
    }
    // and behind it, nothing: a hole no light gets to the bottom of
    const gullet = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    gullet.scale.set(1.1, 0.7, 1);
    gullet.position.set(0, MOUTH_Y - 0.05, MOUTH_Z - 0.1);
    this.head.add(gullet);
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
        // short at the front, longer toward the sides, and a few much longer:
        // long thin needles, narrow at the root and fine at the point
        // Longer and heavier than they were: needles still, but big enough to
        // read from across a room, and a few real fangs among them.
        // Longer again, more of them fangs, and no two alike: a few snapped
        // off short, which is what makes the rest look used.
        const fang = rnd() < 0.28;
        const broken = !fang && rnd() < 0.1;
        const h = (0.031 + rnd() * 0.034) * (0.8 + side * 0.6) * (fang ? 1.9 : broken ? 0.55 : 1) * lengthK;
        const w = (0.0034 + rnd() * 0.0024) * (fang ? 1.4 : 1);
        const g = new THREE.ConeGeometry(w, h, 6, 3);
        // taper faster toward the tip than a cone does, so the point is a point
        {
          const p = g.attributes.position as THREE.BufferAttribute;
          for (let v = 0; v < p.count; v++) {
            const t = THREE.MathUtils.clamp(p.getY(v) / h + 0.5, 0, 1);
            const pinch = 1 - 0.45 * t * t;
            p.setX(v, p.getX(v) * pinch);
            p.setZ(v, p.getZ(v) * pinch);
          }
        }
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
        // crooked: every one leaning its own way, some of them a long way
        tooth.rotation.z = (rnd() - 0.5) * (rnd() < 0.25 ? 0.9 : 0.5);
        tooth.rotation.x += (rnd() - 0.5) * 0.42;
        parent.add(tooth);
        if (down) this.upperTeeth.push(tooth);
        this.allTeeth.push(tooth);
      }
    };
    // ---- THE GUMS: a raw, lumpy ridge along the root of each row, so the
    // teeth come out of flesh rather than out of a seam.
    const gumMat = new THREE.MeshPhongMaterial({ color: GUM, specular: 0x4a2a2a, shininess: 60 });
    const gum = (parent: THREE.Object3D, y: number, inset: number, droop: number, seed: number): void => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) {
        const a = 0.1 + (i / 20) * (Math.PI - 0.2);
        const p = rim(a, inset, droop);
        p.y += y;
        pts.push(p);
      }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.009, 6, false);
      parent.add(new THREE.Mesh(lumpy(g, 0.0025, 40, seed), gumMat));
    };
    gum(this.head, MOUTH_Y + 0.006, 0.9, 0.024, 311);
    let lengthK = 1;
    teeth(this.head, MOUTH_Y + 0.004, true, 0.88, 30, 1301);
    // and a second row behind the first, shorter, the way a shark's are
    lengthK = 0.7;
    teeth(this.head, MOUTH_Y + 0.004, true, 0.72, 22, 1777);
    lengthK = 1;
    // THE CORNERS OF THE MOUTH, in the face.  A fold of flesh at each end --
    // a jowl -- that the lips run into and that runs back into the cheek, so
    // the seam ends in skin.  (Without it the corners stood out past the side
    // of the head with daylight behind them: lips that were not attached.)
    for (const side of [-1, 1]) {
      const at = rim(side > 0 ? -0.06 : Math.PI + 0.06, 0.97, 0.024);
      at.y += MOUTH_Y - 0.004;
      const jowl = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.05, 14, 10), 0.003, 9, 401 + side), face);
      jowl.scale.set(0.95, 0.85, 1.5);
      jowl.position.set(at.x - side * 0.018, at.y, at.z - 0.04);
      this.head.add(jowl);
      // and the skin gathered where the seam ends: creases fanning back
      // across the jowl from the corner, lying on it
      for (let c = 0; c < 3; c++) {
        const p = at.clone().add(new THREE.Vector3(side * 0.006, 0.006 - c * 0.012, -0.012));
        const q = p.clone().add(new THREE.Vector3(side * 0.008, 0.012 - c * 0.012, -0.03 - c * 0.004));
        this.head.add(strut(p, q, 0.0028, skinDark));
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
    this.lowerJaw = lower;
    gum(lower, -0.006, 0.88, 0, 313);
    teeth(lower, -0.004, false, 0.86, 26, 2203);
    this.head.add(this.jaw);

    // Spit between the lips: the upper ends on the roof of the mouth just
    // inside the upper lip, the lower ends inside the lower lip (jaw space).
    const ends: { top: THREE.Vector3; bottom: THREE.Vector3 }[] = [];
    for (const a of [0.34, 0.95, 1.42, 1.83, 2.4, 2.86]) {
      const top = rim(a, 0.9, 0.024);
      top.y += MOUTH_Y - 0.002;
      const bottom = rim(a + 0.06, 0.9, 0);
      bottom.y -= 0.004;
      bottom.z -= JAW_PIVOT_Z;
      ends.push({ top, bottom });
    }
    // the drop hangs off the lower lip at the left corner, the one that droops
    const dropFrom = rim(Math.PI - 0.08, 1.0, 0);
    dropFrom.y -= 0.008;
    dropFrom.z -= JAW_PIVOT_Z;
    this.drool = new Drool(this.head, this.jaw, ends, dropFrom);

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

  /** Both arms, shoulder to fingertips, for anything that must keep them inside something. */
  get armObjects(): readonly THREE.Object3D[] {
    return this.arms;
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
    // (a frame clock can hand over a negative step once, on the first frame
    // after a scene starts; time does not go backwards for him)
    dt = Math.max(0, dt);
    const speed = Math.max(0, pose.speed);
    this.breathT += dt;
    // The IK below writes whole rotations; everything else only ever writes
    // x and z, so the axes it leaves behind are cleared here.
    for (let h = 0; h < 2; h++) {
      this.arms[h].rotation.y = 0;
      this.elbows[h].rotation.y = 0;
    }
    // The floor and the solids come in the space he is placed in (setPose's);
    // the tests are done in the world, so the floor is taken across to it.
    {
      const par = this.root.parent;
      const fl = pose.floor ?? this.root.position.y;
      this.floorY = par ? par.localToWorld(this.tmp.set(this.root.position.x, fl, this.root.position.z)).y : fl;
      this.sizeW = (par ? par.getWorldScale(this.tmp).y : 1) * this.size;
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

    // Stillness comes on at once -- he stops -- and goes off slowly.
    const stillWant = pose.still ?? 0;
    this.stillNow += (stillWant - this.stillNow) * Math.min(1, dt * (stillWant > this.stillNow ? 20 : 2));
    const live = 1 - this.stillNow;
    this.hunchNow += ((pose.hunch ?? 0) + this.varHunch - this.hunchNow) * Math.min(1, dt * 3);
    this.tiltNow += ((pose.tilt ?? 0) + this.varTilt - this.tiltNow) * Math.min(1, dt * 3);
    this.stretchNow += ((pose.stretch ?? 0) - this.stretchNow) * Math.min(1, dt * 16);
    // Drawn out fast -- it is the scare's -- and let back slowly.
    this.pounceNow += ((pose.pounce ?? 0) - this.pounceNow) * Math.min(1, dt * ((pose.pounce ?? 0) > this.pounceNow ? 18 : 3));
    this.menaceNow += ((pose.menace ?? 0) - this.menaceNow) * Math.min(1, dt * 2.5);
    // the scream comes on at once and goes slowly
    this.rageNow += ((pose.rage ?? 0) - this.rageNow) * Math.min(1, dt * ((pose.rage ?? 0) > this.rageNow ? 14 : 3));
    // (braced, the fingers are drawn out a touch: claws -- a touch, not the
    // stretched rake they were, which read as a different, broken hand)
    this.setArmLength(1 + 0.35 * this.pounceNow, 1 + 0.55 * this.pounceNow + 0.08 * this.menaceNow);
    // a cold sheen on the reaching arms, so the long hands read in the dark
    // at the edges of the frame, where no lamp is pointed
    this.armSkin?.emissive.setRGB(0.028 * this.pounceNow, 0.03 * this.pounceNow, 0.036 * this.pounceNow);

    // ---- THE TWITCH.  Every second or few the head SNAPS -- no ease into it
    // -- somewhere it was not asked to go, holds there, and lets go.  Mostly a
    // tick of a few degrees; now and then a hard turn of the whole head that
    // stops dead, which is the one that makes a player look where he is
    // looking.  Hunting, they come more often.
    this.twitchIn -= dt;
    if (this.twitchIn <= 0) {
      const hunting = (pose.lunge ?? 0) > 0.5;
      this.twitchIn = (hunting ? 0.9 : 1.6) + Math.random() * (hunting ? 2.2 : 3.4);
      const sharp = Math.random() < 0.3;
      const k = sharp ? 0.42 + Math.random() * 0.2 : 0.1 + Math.random() * 0.12;
      const sgn = () => (Math.random() < 0.5 ? -1 : 1);
      this.twitchTo.set(sgn() * k * 0.35, sgn() * k, sgn() * k * (sharp ? 0.45 : 0.9));
      this.twitchHold = sharp ? 0.32 + Math.random() * 0.25 : 0.1 + Math.random() * 0.12;
      this.twitchT = this.twitchHold + 0.35;
    }
    let tw = 0;
    if (this.twitchT > 0) {
      this.twitchT = Math.max(0, this.twitchT - dt);
      // full on the frame it fires, held, then eased back out
      tw = this.twitchT > 0.35 ? 1 : this.twitchT / 0.35;
    }
    tw *= live;
    const twitch = this.twitchTo.y * tw;

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
    const legLen = HIP_Y;
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
    // Standing still, the stride lets go: the feet come back under him
    // rather than staying wherever the last step left them.
    for (let i = 0; i < 2; i++) {
      footX[i] *= moving;
      footY[i] *= moving;
      // Toes down means the HEEL is up, not the toes through the boards: the
      // ankle rides up by what the long toes drop.
      footY[i] = Math.max(footY[i], TOE_REACH * Math.sin(Math.max(0, ank[i] * moving)));
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
    this.hipH = Math.max(0.1, Math.min(want, (this.hipH || want) + dt * 2.5));
    const hipH = this.hipH;

    // ---- DOWN ON HIS HAUNCHES.  The hips come right down and the legs are
    // SOLVED to it, the same as every step: the knees fold up in front of him
    // and splay out, and the feet stay flat on the floor under him.  (It used
    // to add a fixed fold to the stride's angles, which put both feet half a
    // metre through the floor.)  The squat takes the stride's place as it
    // comes on, so he can still be settling as he arrives.
    const cr = this.crouchNow;
    // ...and going over something, the hips are where the climb has put them
    // and each foot is solved onto what it is standing on.
    const rig = pose.climbRig ?? null;
    const rk = rig ? THREE.MathUtils.clamp(rig.k, 0, 1) : 0;
    const hipWalk = hipH + (SQUAT_HIP - hipH) * cr;
    const hipRig = rig ? rig.hip / this.sizeW - SOLE : hipWalk;
    const hipAt = hipWalk + (hipRig - hipWalk) * rk;
    if (rig) this.root.updateMatrixWorld(true);
    const splay = Math.max(0.4 * cr, (rig?.splay ?? 0) * rk);
    const cosSplay = Math.cos(splay);
    // THE LEGS, solved: each ankle put exactly where its foot has to be.
    for (let i = 0; i < 2; i++) {
      // measured from this hip joint, which the pelvis's twist carries a
      // little forward or back
      let z = (footX[i] * (1 - cr) + 0.06 * cr + (i === 0 ? -1 : 1) * 0.1 * Math.sin(this.hips.rotation.y)) / cosSplay;
      // (a leg splayed out sideways is that much shorter top to bottom)
      let h = Math.max(0.05, hipWalk - footY[i] * (1 - cr)) / cosSplay;
      if (rig && rk > 0) {
        // the foot, where the climb put it, in his own units
        const f = this.root.worldToLocal(this.tmp.copy(rig.feet[i])).divideScalar(BODY_SCALE);
        z += (f.z - z) * rk;
        // (under the hip joint, but never above it: a foot is not a hand --
        // and as the walk takes back over, the heel up by whatever its toes
        // drop, the same as a step)
        const toe = TOE_REACH * Math.sin(Math.max(0, ank[i] * moving * (1 - rk)));
        h += (Math.max(0.05, hipRig - f.y - toe) - h) * rk;
      }
      const d = Math.min(reachMax * 0.999, Math.hypot(z, h));
      const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((THIGH * THIGH + SHIN * SHIN - d * d) / (2 * THIGH * SHIN), -1, 1));
      const along = Math.acos(THREE.MathUtils.clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
      // forward is negative on this rig; the knee always points forward
      th[i] = -(Math.atan2(z, h) + along);
      kn[i] = bend;
      ank[i] *= moving;
    }
    // the hip joint is built HIP_Y up; this puts it hipH + SOLE over the floor
    const gaitDrop = hipH + SOLE - HIP_Y;
    // weight over the planted leg: sway toward it, the free hip dropping
    const sway = (lift[0] - lift[1]) * (0.026 - 0.01 * run) * moving;
    const roll = (lift[0] - lift[1]) * (0.07 - 0.03 * run) * moving;
    // the hip on the forward leg comes forward with it
    const pelvisYaw = (th[1] - th[0]) * 0.22;

    this.legs[0].rotation.x = th[0];
    this.legs[1].rotation.x = th[1];
    this.knees[0].rotation.x = kn[0];
    this.knees[1].rotation.x = kn[1];

    // And the foot: flat to what it is on, whatever the leg is doing above
    // it -- the floor, or the top of the thing he is going over -- and
    // pointed as it leaves and as it lands.
    const level = (i: number) => THREE.MathUtils.clamp(-(this.legs[i].rotation.x + this.knees[i].rotation.x), -1.3, 1.3);
    // (the walk's toe-off and toe-down are the walk's: going over something,
    // each foot is flat on what it is put on)
    this.ankles[0].rotation.x = level(0) + ank[0] * (1 - cr) * (1 - rk) + (rig?.hang?.[0] ?? 0) * 1.1 * rk;
    this.ankles[1].rotation.x = level(1) + ank[1] * (1 - cr) * (1 - rk) + (rig?.hang?.[1] ?? 0) * 1.1 * rk;

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
    // (going over something the walk's swing is let go of: the hands are on it)
    const swingK = 1 - rk;
    this.arms[0].rotation.x = armSwing[0] * carry * swingK + armReach(gL);
    this.arms[1].rotation.x = armSwing[1] * carry * swingK + armReach(gR);
    // the elbow folds as the arm comes forward, and hangs open going back
    this.elbows[0].rotation.x =
      -(0.2 + Math.max(0, -armSwing[0]) * (0.7 + 0.5 * run) * swingK) * carry - rk * 0.3 + elbowReach(gL);
    this.elbows[1].rotation.x =
      -(0.2 + Math.max(0, -armSwing[1]) * (0.7 + 0.5 * run) * swingK) * carry - rk * 0.3 + elbowReach(gR);
    // the shoulders ride up and down with the step, one against the other
    for (let h = 0; h < 2; h++) {
      if (this.armBaseY.length < 2) this.armBaseY.push(this.arms[h].position.y);
      this.arms[h].position.y = this.armBaseY[h] + lift[1 - h] * 0.014 * (1 - reach * 0.5) - lift[h] * 0.006;
    }
    // Out wide on the push, in on the pull: the gap between his hands opens
    // and closes around where you are standing.
    this.arms[0].rotation.z = -rk * 0.2 - reach * (0.1 + 0.26 * gL) - this.varSplay * (1 - reach);
    this.arms[1].rotation.z = rk * 0.2 + reach * (0.1 + 0.26 * gR) + this.varSplay * (1 - reach);
    // And the hands close as they come back, which is what makes it a grab
    // rather than a wave.
    for (let h = 0; h < this.hands.length; h++) {
      const g = h === 0 ? gL : gR;
      // the long fingers hang a little curled, and curl shut on the grab
      for (let f = 0; f < this.hands[h].length; f++) {
        const finger = this.hands[h][f];
        const idle = 0.12 + Math.sin(this.breathT * 0.9 + f * 1.3 + h) * 0.05 * live + this.hunchNow * 0.25;
        // each finger working on its own, a little, as they reach
        const work = Math.sin(this.breathT * (7 + f * 1.3) + h * 2 + f) * 0.14 * reach;
        finger.rotation.x = (f === 4 ? 0.4 : 0) + idle + reach * (0.15 + 0.95 * (1 - g)) + work;
      }
    }
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
    this.hips.position.y = gaitDrop + (hipAt - hipH) + breath;
    this.hips.position.x = sway * (1 - cr);
    // (and nothing is pushing him out of anything yet: see `unclip`)
    this.hips.position.z = 0;
    // ---- HE BREATHES WRONG.  The cage swells and falls on a slow rhythm
    // with a catch in it -- two quick shallow pulls, then a long one -- so
    // the one part of him that moves standing still does not move like an
    // animal's.
    if (this.chest) {
      const b = this.breathT;
      const hitch = Math.max(0, Math.sin(b * 0.9)) * 0.045 + Math.max(0, Math.sin(b * 4.4)) * 0.012 * (Math.sin(b * 0.45) > 0.3 ? 1 : 0);
      const hb = hitch * (0.35 + 0.65 * live);
      this.chest.scale.set(0.98 + hb * 0.4, 1.55 + hb, 0.78 + hb * 0.9);
    }
    // A slight roll off the same limp, so his weight goes side to side.
    this.hips.rotation.z = roll * (1 - cr) * (1 - rk) + (rig ? rig.roll * rk : 0);
    this.hips.rotation.y = pelvisYaw * (1 - cr);
    // ...and the legs take that roll, sway and twist back out of themselves,
    // so the pelvis moves over the feet and the feet stay where they are
    for (let i = 0; i < 2; i++) {
      this.legs[i].rotation.z =
        (-roll - Math.asin(THREE.MathUtils.clamp(sway / Math.max(0.3, this.hipH), -0.3, 0.3))) * (1 - cr) + (i === 0 ? -1 : 1) * splay;
      this.legs[i].rotation.y = -pelvisYaw * (1 - cr);
    }

    // Folded forward, further the faster he moves, and further again once he is
    // coming for you.  A climb folds him as far as the climb says.
    // Upright, with a stoop that never straightens: he is too tall for every
    // room he is in.  Faster and hunting, the stoop deepens into a prowl.
    // Chasing, the whole long body goes after you: folded well forward, and
    // further still as he closes.
    this.torso.rotation.x =
      0.14 + Math.min(0.2, speed * 0.05) * (1 - rk) + this.lungeNow * (0.5 + this.nearNow * 0.1) * (1 - rk) +
      cr * 0.62 + this.leanNow * 0.55 +
      // flat to the floor to get his face down to a gap: past level, the
      // shoulders lower than the hips, so the huge head can come down to the
      // boards with its face turned into the dark
      this.peekNow * 1.05;
    if (rig) this.torso.rotation.x += (rig.pitch - this.torso.rotation.x) * rk;
    // The shoulders twist against the hips -- the whole long back wrings a
    // little with every step -- and lean out over the planted foot.
    this.torso.rotation.y = -pelvisYaw * 1.7 * (1 - cr);
    this.torso.rotation.z = -roll * 0.6 + gait * 0.02 * moving;
    // Climbing, the back is an S: the shoulders wrung one way, the hips
    // the other, the pulling shoulder dropped -- trembling while it hauls.
    const climbTwist = rig ? (rig.twist ?? 0) * rk : 0;
    const climbDrop = rig ? (rig.drop ?? 0) * rk : 0;
    const shake = rig ? (rig.strain ?? 0) * rk * (Math.sin(this.breathT * 41) * 0.6 + Math.sin(this.breathT * 29 + 1) * 0.4) : 0;
    this.torso.rotation.y += climbTwist;
    this.hips.rotation.y -= climbTwist * 0.45;
    this.torso.rotation.z += climbDrop + shake * 0.025;
    this.torso.rotation.x += shake * 0.015;

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
      -0.04 - Math.min(0.16, speed * 0.04) * (1 - rk) - this.lungeNow * 0.36 * (1 - rk) -
      // folded right over going across something, the head is lifted back
      // against the fold: the face stays on the room, which is worse
      // (all of it: the head stays level and staring however he heaves)
      (rig ? Math.max(0, rig.pitch - 0.1) * 1.0 * rk : 0) +
      cr * 0.5 - this.leanNow * 0.3;
    // Craning: slow, small, side to side, and offset from the body's own sway
    // so the two never line up into something that looks mechanical.
    this.neck.rotation.y =
      this.scanNow + twitch + Math.sin(this.breathT * 1.9) * 0.3 * peer +
      // the head holds its line while the body wrings under it...
      pelvisYaw * 0.7 * (1 - cr) +
      // ...and gets round a turn before the body does
      THREE.MathUtils.clamp(this.yawLag * 0.8, -0.7, 0.7) -
      // the gaze is locked: the head does not ride the wringing back
      climbTwist;
    // and the head cocks: slowly over to one side and back, the way a thing
    // does that is listening for you
    this.neck.rotation.z =
      -gait * 0.05 + this.twitchTo.z * tw + Math.sin(this.breathT * 1.3 + 1.1) * 0.16 * peer +
      Math.sin(this.breathT * 0.37) * 0.09 * live +
      this.tiltNow - climbDrop - shake * 0.025;
    this.neck.rotation.x += this.peekNow * 0.6;
    // Over on its side to look into a gap -- rolled about the middle of the
    // head, not the root of the neck, so the face stays where the neck put
    // it (at the gap) instead of being swung half a metre off to one side.
    this.head.rotation.set(0, 0, this.peekNow * (1.45 + Math.sin(this.breathT * 0.8) * 0.06));
    // ---- HUNCHED.  The shoulders round, the whole back comes over, and the
    // head is pushed out in front on its neck -- levelled back up, so the
    // face stays on you while the body leans in toward you.
    const hu = this.hunchNow;
    this.torso.rotation.x += hu * 0.34;
    this.neck.rotation.x -= hu * 0.3;
    this.neck.position.z = 0.01 + hu * 0.05;

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
    const hang = (this.torso.rotation.x + this.hips.rotation.x) * (1 - reach) * (1 - cr);
    for (const arm of this.arms) arm.rotation.x -= hang * 0.95 + 0.05 * (1 - reach);
    // Hunched, they hang DEAD: a little out from the body, one elbow locked
    // and the other with a slight wrong bend in it, the fingers half shut.
    if (hu > 0.001) {
      const dead = hu * (1 - reach) * (1 - this.climbNow);
      this.arms[0].rotation.z -= 0.07 * dead;
      this.arms[1].rotation.z += 0.04 * dead;
      this.elbows[0].rotation.x += (-0.02 - this.elbows[0].rotation.x) * dead;
      this.elbows[1].rotation.x += (-0.32 - this.elbows[1].rotation.x) * dead;
    }

    // ---- THE WARNING.  Everything about him says he is about to, and he
    // does not.  The breath is deep and ragged and the shoulders ride up on
    // it; the head sinks down between them; the back comes over you; the arms
    // come off his sides, bent at the elbow, hands out in front at his hips
    // with the fingers spreading and clawing shut on their own; and through
    // all of it a fine fast shake, the effort of holding still.
    const mn = this.menaceNow * (1 - reach) * (1 - this.climbNow);
    if (Number.isNaN(this.neckBaseY)) this.neckBaseY = this.neck.position.y;
    // going over something, the head sinks down between the shoulders
    this.neck.position.y = this.neckBaseY - 0.05 * this.climbNow;
    if (mn > 0.001) {
      const b = this.breathT;
      // in on a long pull, out in a rush: lowest, then up and held
      const heave = Math.max(0, Math.sin(b * 1.7)) ** 2;
      const quiver = (k: number): number => Math.sin(b * 37 + k) * 0.011 + Math.sin(b * 53 + k * 2.1) * 0.007;
      this.torso.rotation.x += mn * (0.12 + heave * 0.03);
      this.neck.rotation.x -= mn * 0.1;
      // the head goes down between the shoulders as they come up
      this.neck.position.y = this.neckBaseY - mn * (0.045 + heave * 0.012);
      for (let h = 0; h < 2; h++) {
        const out = h === 0 ? -1 : 1;
        if (this.armBaseY.length === 2) this.arms[h].position.y += mn * (0.022 + heave * 0.012);
        // off the sides, wide, a little forward -- held there, low, so the
        // claws are at his hips and nothing comes up across his face
        this.arms[h].rotation.x += (-0.14 - heave * 0.03 + quiver(h) - this.arms[h].rotation.x) * mn;
        this.arms[h].rotation.z += out * mn * (0.42 + heave * 0.04) + quiver(h + 3) * mn;
        // the elbows bent, the forearms angled forward and down at you
        this.elbows[h].rotation.x += (-1.25 + quiver(h + 5) * 1.5 - this.elbows[h].rotation.x) * mn;
        // the fingers: spread, then clawing in, each on its own beat
        for (let f = 0; f < this.hands[h].length; f++) {
          const flex = 0.5 + 0.5 * Math.sin(b * (1.25 + f * 0.19) + h * 1.7 + f * 1.1);
          const claw = (f === 4 ? 0.3 : 0) + 0.05 + 1.05 * flex * flex + quiver(f + h * 7) * 2;
          const fing = this.hands[h][f];
          fing.rotation.x += (claw - fing.rotation.x) * mn;
        }
      }
      if (this.chest) {
        const deep = heave * 0.07 * mn;
        this.chest.scale.x += deep * 0.5;
        this.chest.scale.y += deep;
        this.chest.scale.z += deep * 1.1;
      }
      // ---- AND THE SCREAM.  At full voice the arms come UP: the upper arms
      // swing forward and out to either side of him, the elbows bend so the
      // forearms rise toward you, and the hands open into claws at the height
      // of his chest -- a thing about to come at you with both of them, not
      // two long arms hanging.  The back comes over and the head is thrown
      // forward into it, and the whole of him shakes with the voice.
      const rg = this.rageNow * mn;
      if (rg > 0.001) {
        const shake = Math.sin(b * 61) * 0.02 + Math.sin(b * 89) * 0.012;
        this.torso.rotation.x += rg * (0.14 + shake);
        this.neck.rotation.x += rg * (-0.16 + shake * 0.6);
        for (let h = 0; h < 2; h++) {
          const out = h === 0 ? -1 : 1;
          this.arms[h].rotation.x += (-1.2 + shake - this.arms[h].rotation.x) * rg;
          this.arms[h].rotation.z += (out * 0.42 + shake * out - this.arms[h].rotation.z) * rg;
          this.elbows[h].rotation.x += (-0.85 - this.elbows[h].rotation.x) * rg;
          for (let f = 0; f < this.hands[h].length; f++) {
            const fing = this.hands[h][f];
            // spread wide and hooked at the tips: a claw, held open
            fing.rotation.x += ((f === 4 ? 0.5 : 0.75) + Math.sin(b * 23 + f) * 0.06 - fing.rotation.x) * rg;
          }
        }
      }
    }

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
    // The reach turns the head onto you and would take the twitch out with
    // it; on the hunt it goes back on top, a jerk away and straight back.
    if (reach > 0.01) {
      this.neck.rotation.y += twitch * reach * 0.7;
      this.neck.rotation.x += this.twitchTo.x * tw * reach;
    } else {
      this.neck.rotation.x += this.twitchTo.x * tw;
    }

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

    // ---- HIS FACE ONTO SOMETHING.  Not only the eyes: the head turns to it
    // (the dark under a bed, the inside of a locker), over the top of
    // whatever the body is doing, and the roll a peek puts on it stays.
    const faceWant = pose.faceTo ? THREE.MathUtils.clamp(pose.faceK ?? 1, 0, 1) : 0;
    this.faceNow += (faceWant - this.faceNow) * Math.min(1, dt * 5);
    if (pose.faceTo) this.faceAtV.copy(pose.faceTo);
    if (this.faceNow > 0.001) {
      this.torso.updateWorldMatrix(true, false);
      const at = this.torso.worldToLocal(this.tmp.copy(this.faceAtV)).sub(this.neck.position);
      // aimed from the middle of the head rather than from the root of the neck
      at.y -= 0.24;
      const n = Math.max(1e-4, at.length());
      // (the neck's Euler: pitch, then yaw, then the roll about the face)
      const yaw = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(at.x / n, -1, 1)), -1.1, 1.1);
      const pitch = THREE.MathUtils.clamp(Math.atan2(-at.y, Math.max(0.05, at.z)), -1.2, 1.5);
      this.neck.rotation.x += (pitch - this.neck.rotation.x) * this.faceNow;
      this.neck.rotation.y += (yaw - this.neck.rotation.y) * this.faceNow;
    }

    // ---- NOTHING OF HIM THROUGH THE FLOOR OR INTO THINGS.
    this.unclip(pose);

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

    // (last, after the eye guard has swung them: nothing after this moves an arm)
    // A hand that is on nothing hangs -- and on a body folded down this low,
    // hanging can put the fingers through the floor.  It is swung forward,
    // the way the hand would be dragged along the boards, until it is not.
    // (A hand coming off the floor as he gets up is half on it and half
    // hanging, and the blend of the two can be through it: that is caught
    // here too.  One firmly on something is where it was put.)
    for (let h = 0; h < 2; h++) {
      if (this.held[h] > 0.95 || this.climbNow > 0.3) continue;
      const tipY = (): number => {
        this.arms[h].updateMatrixWorld(true);
        // the lower of the elbow, the wrist and the fingertips
        const e = this.elbows[h];
        const elbowY = e.getWorldPosition(this.clipW).y;
        const wristY = e.localToWorld(this.clipW.set(0, -0.57 * this.armK, 0)).y;
        const tip = e.localToWorld(this.clipW.set(0, -(0.57 * this.armK + 0.12 + 0.28 * this.fingerK), 0)).y;
        return Math.min(elbowY, wristY, tip);
      };
      const floor = this.floorY + 0.03 * this.sizeW;
      let y = tipY();
      for (let i = 0; i < 4 && y < floor; i++) {
        const x0 = this.arms[h].rotation.x;
        this.arms[h].rotation.x = x0 - 0.1;
        const yF = tipY();
        const dir = yF > y ? -1 : 1;
        const gain = Math.max(1e-3, Math.abs(yF - y) / 0.1);
        this.arms[h].rotation.x = x0 + dir * Math.min(0.6, (floor - y) / gain + 0.02);
        y = tipY();
      }
    }
    // AND OUT OF THINGS.  An arm on nothing -- let go of a door, hanging at
    // his side as he leans in -- is swung out of whatever it has gone into,
    // whichever way (forward, back, or out from his side) clears it
    // quickest.  An arm with its hand on something is where it was put.
    this.armsOutOfSolids(pose.solids ?? null);

    // And the fingers.  A palm flat on the floor at the end of a steep
    // forearm would put the long fingers straight on down through it; each
    // one bends at the knuckle instead, whichever way lifts it, until it lies
    // along the boards -- which is how a hand that long takes weight.
    // (and on the top of something he is climbing, on that)
    {
      const rig = pose.climbRig;
      for (let h = 0; h < 2; h++) {
        const onTop = rig && rig.k > 0.01 && this.held[h] > 0.01;
        const floor = (onTop ? Math.max(this.floorY, rig.top) : this.floorY) + 0.015 * this.sizeW;
        this.arms[h].updateMatrixWorld(true);
        for (const f of this.hands[h]) {
          const tipY = (): number => {
            f.updateMatrixWorld(true);
            return f.localToWorld(this.clipW.set(0, -0.26, 0.004)).y;
          };
          let y = tipY();
          const x0 = f.rotation.x;
          for (let i = 0; i < 3 && y < floor; i++) {
            const was = f.rotation.x;
            f.rotation.x = was + 0.15;
            const yUp = tipY();
            const dir = yUp > y ? 1 : -1;
            const gain = Math.max(1e-3, Math.abs(yUp - y) / 0.15);
            f.rotation.x = THREE.MathUtils.clamp(was + dir * ((floor - y) / gain + 0.01), x0 - 1.6, x0 + 1.6);
            y = tipY();
          }
        }
      }
    }


    // ---- THE JAW.  Hinged too far back, so it drops a long way; and it
    // drops very slightly crooked, skewed to one side, which no jaw should.
    // Parted a crack while he searches, working, and wide once he has you.
    // Open, it is never still: a fine tremor in it, and now and then a slow
    // working of the jaw, as if tasting the air.
    const m = this.mawNow;
    this.bareNow += ((pose.bare ?? 0) - this.bareNow) * Math.min(1, dt * ((pose.bare ?? 0) > this.bareNow ? 12 : 3));
    const bare = this.bareNow;
    const work = Math.max(0, Math.sin(this.breathT * 0.9)) ** 3 * 0.05 * m * live;
    const st = this.stretchNow;
    // NEVER QUITE SHUT.  Parted a crack even at rest, onto the tips of the
    // teeth, and held there under tension: a fine fast tremor in the jaw that
    // does not stop when everything else about him does.
    const tension = Math.sin(this.breathT * 31) * 0.0045 + Math.sin(this.breathT * 47 + 1) * 0.0025;
    this.jaw.rotation.x =
      0.05 + m * (0.5 + 0.22 * bare) + Math.max(0, Math.sin(this.breathT * 2.1)) * 0.012 * (0.4 + m) * live +
      Math.sin(this.breathT * 23) * 0.006 * m + work + tension +
      // and past where a jaw stops, when it is the last thing you see: a little
      // further round, and the rest of it DOWN -- the hinge coming out of its
      // socket -- so the chin stays under the face instead of swinging back
      st * 0.2;
    this.jaw.rotation.z = m * 0.07 + Math.sin(this.breathT * 0.9) * 0.02 * m * live;
    this.jaw.rotation.y = m * 0.035;
    // stretched: the lower jaw drawn out long, the chin going down and away
    this.jaw.scale.set(1 + st * 0.06, 1 + st * 0.55, 1 + st * 0.22);
    this.jaw.position.set(0, MOUTH_Y - st * 0.09, JAW_PIVOT_Z + st * 0.035);
    if (this.lowerJaw) this.lowerJaw.scale.y = 1 + st * 0.35;
    // the wall inside, as deep as the drop at the back of the jaw
    if (this.cavity) {
      const drop = Math.sin(Math.max(0, this.jaw.rotation.x)) * (MOUTH_Z - JAW_PIVOT_Z + MOUTH_D * 0.2) * this.jaw.scale.z;
      // (the pouch is a ball two units tall, hung from the roof: half as much)
      this.cavity.scale.y = Math.max(0.001, (drop * this.jaw.scale.y * 1.1 + st * 0.09) * 0.5);
    }
    // the long upper teeth draw up into the gum while the mouth is shut, so
    // they never come through the chin, and are at full length once it opens
    const long = 0.72 + 0.28 * THREE.MathUtils.clamp(m * 3, 0, 1);
    // bared, every tooth pushes out of the gum and thickens
    const out = 1 + 0.35 * bare * THREE.MathUtils.clamp(m * 2, 0, 1);
    for (const t of this.allTeeth) {
      t.scale.y = (this.upperTeeth.includes(t) ? long : 1) * out;
      t.scale.x = t.scale.z = 1 + 0.25 * bare;
    }
    this.drool?.update(dt, m);

    // ---- THE THROAT.  A swallow every few seconds: the knot in the neck
    // goes up and comes down.
    this.swallowIn -= dt;
    if (this.swallowIn <= 0 && this.swallowT < 0) {
      this.swallowT = 0;
      this.swallowIn = 3 + Math.random() * 5;
    }
    if (this.apple) {
      let lift = 0;
      if (this.swallowT >= 0) {
        this.swallowT += dt;
        lift = Math.sin(Math.min(1, this.swallowT / 0.6) * Math.PI);
        if (this.swallowT > 0.6) this.swallowT = -1;
      }
      this.apple.position.y = 0.07 + lift * 0.035;
    }

    this.dilateWant = pose.dilate ?? 0;
    this.constrictWant = pose.constrict ?? 0;
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
    const A = 0.57 * this.armK; // shoulder to elbow
    const B = 0.57 * this.armK + 0.09 * this.fingerK; // elbow to palm
    const len = THREE.MathUtils.clamp(d.length(), Math.abs(A - B) + 0.03, (A + B) * 0.995);
    const u = d.normalize();
    // where the elbow wants to go: out to the side, back, and a little up --
    // and for the pounce, UP: the elbows high over the shoulders, a mantis's
    const pole = goal.pole
      ? this.tmp2.copy(goal.pole).applyQuaternion(this.torso.getWorldQuaternion(this.q2).invert())
      : this.tmp2.set(out * (0.85 - 0.25 * this.pounceNow), 0.25 + 0.75 * this.pounceNow, -0.45 + 0.2 * this.pounceNow);
    pole.addScaledVector(u, -pole.dot(u));
    if (pole.lengthSq() < 1e-6) pole.set(out, 0, 0).addScaledVector(u, -u.x * out);
    pole.normalize();
    const alpha = Math.acos(THREE.MathUtils.clamp((A * A + len * len - B * B) / (2 * A * len), -1, 1));
    // NEVER THROUGH THE FLOOR.  On all fours, with his hands flat and his
    // shoulders low, the elbow the pole asks for can be under the boards.
    // The elbow can go anywhere on a circle round the line to the hand; if
    // this one is too low it is turned round that circle toward the top of it.
    {
      const shW = this.torso.localToWorld(this.tmp5.copy(S));
      const toW = (v: THREE.Vector3) => v.applyQuaternion(this.torso.getWorldQuaternion(this.q2));
      const scaleW = this.sizeW;
      const elbowY = (p: THREE.Vector3) => {
        const e0 = this.tmp6.copy(u).multiplyScalar(Math.cos(alpha)).addScaledVector(p, Math.sin(alpha));
        return shW.y + toW(e0).y * A * scaleW;
      };
      const floor = this.floorY + 0.06 * scaleW;
      const y0 = elbowY(pole);
      if (y0 < floor) {
        // the highest the elbow can be: the world's up, flattened onto the circle
        const upL = this.tmp6.set(0, 1, 0).applyQuaternion(this.torso.getWorldQuaternion(this.q2).invert());
        const top = upL.addScaledVector(u, -upL.dot(u));
        if (top.lengthSq() > 1e-6) {
          top.normalize();
          const best = top.clone();
          const y1 = elbowY(best);
          if (y1 > y0) {
            const k = THREE.MathUtils.clamp((floor - y0) / (y1 - y0), 0, 1);
            pole.lerp(best, k).normalize();
          }
        }
      }
    }
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
      // Coming for you, each long finger works on its own -- curling,
      // straightening, out of step with the others -- like something that
      // cannot wait to close them.
      const claw = this.pounceNow * (0.3 * Math.sin(this.breathT * 11 + f2 * 1.9 + h * 2.3) + 0.12 * Math.sin(this.breathT * 27 + f2 * 4.1));
      const want = open + (shut - open) * THREE.MathUtils.clamp(goal.grip, 0, 1) + claw;
      finger.rotation.x += (want - finger.rotation.x) * w;
    }
    this.held[h] = w;
  }

  /**
   * The lowest point of his head and jaw in the world, as posed right now --
   * the jaw however far it has dropped and stretched.  For a caller that
   * puts his face somewhere itself (the jumpscare) and must keep it out of
   * the floor.
   */
  headBottom(): number {
    if (this.clipPts.length === 0) this.buildClipPts();
    this.root.updateMatrixWorld(true);
    let low = Infinity;
    for (const { o, p } of this.clipPts) {
      if (o !== this.head && o !== this.jaw) continue;
      low = Math.min(low, o.localToWorld(this.clipW.copy(p)).y);
    }
    return low;
  }

  /** How deep, in all, the points down one arm are inside the solids. */
  private armDepth(h: number, solids: Solid[]): number {
    const par = this.root.parent;
    this.arms[h].updateMatrixWorld(true);
    const e = this.elbows[h];
    let depth = 0;
    const ys = [0.2 * this.armK, 0.45 * this.armK];
    const pts: THREE.Vector3[] = [];
    for (const y of ys) pts.push(this.arms[h].localToWorld(new THREE.Vector3(0, -y, 0)));
    for (const y of [0, 0.3 * this.armK, 0.57 * this.armK, 0.57 * this.armK + 0.12 + 0.2 * this.fingerK]) pts.push(e.localToWorld(new THREE.Vector3(0, -y, 0)));
    for (const w of pts) {
      if (par) par.worldToLocal(w);
      for (const b of solids) {
        if (w.x <= b.x0 || w.x >= b.x1 || w.z <= b.z0 || w.z >= b.z1 || w.y >= b.y1 || w.y <= (b.y0 ?? -1)) continue;
        depth += Math.min(w.x - b.x0, b.x1 - w.x, w.z - b.z0, b.z1 - w.z, b.y1 - w.y);
      }
    }
    return depth;
  }

  private armsOutOfSolids(solids: Solid[] | null): void {
    if (!solids || solids.length === 0 || this.climbNow > 0.3) return;
    for (let h = 0; h < 2; h++) {
      if (this.held[h] > 0.95) continue;
      const arm = this.arms[h];
      let d = this.armDepth(h, solids);
      for (let i = 0; i < 9 && d > 0.001; i++) {
        // try each way a little, keep the best, and go on in it
        const x0 = arm.rotation.x;
        const z0 = arm.rotation.z;
        const out = h === 0 ? -1 : 1;
        let best = d;
        let bx = x0;
        let bz = z0;
        for (const [dx, dz] of [[-0.25, 0], [0.25, 0], [0, out * 0.25], [-0.18, out * 0.18], [0.18, out * 0.18]]) {
          arm.rotation.x = x0 + dx;
          arm.rotation.z = z0 + dz;
          const t = this.armDepth(h, solids);
          if (t < best) {
            best = t;
            bx = arm.rotation.x;
            bz = arm.rotation.z;
          }
        }
        arm.rotation.x = bx;
        arm.rotation.z = bz;
        if (best >= d - 1e-4) break;
        d = best;
      }
    }
  }

  /** The surface points `unclip` tests, built once, off the shapes the parts were built from. */
  private buildClipPts(): void {
    const dirs: THREE.Vector3[] = [];
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
      if (x || y || z) dirs.push(new THREE.Vector3(x, y, z).normalize());
    }
    const shell = (o: THREE.Object3D, c: [number, number, number], r: [number, number, number], half = 0): void => {
      const id = this.clipShells++;
      const from = this.clipPts.length;
      for (const d of dirs) {
        // a half-dome: only its own half
        if (half > 0 && d.y < -0.01) continue;
        if (half < 0 && d.y > 0.01) continue;
        this.clipPts.push({ o, p: new THREE.Vector3(c[0] + d.x * r[0], c[1] + d.y * r[1], c[2] + d.z * r[2]), shell: id });
      }
      this.clipRange.push([from, this.clipPts.length]);
    };
    // the head: the dome, the cheeks, the upper half of the muzzle, the eyes
    shell(this.head, [0, 0.03, 0], [0.256, 0.18, 0.2]);
    for (const s of [-1, 1]) shell(this.head, [s * 0.13, -0.04, 0.03], [0.12, 0.102, 0.12]);
    shell(this.head, [0, MOUTH_Y, MOUTH_Z], [MOUTH_W, 0.19, MOUTH_D], 1);
    for (const e of this.eyes) shell(this.head, [e.position.x, e.position.y, e.position.z], [0.118, 0.118, 0.118]);
    // the jaw: the chin's lower half, which rides the hinge however far it drops
    shell(this.jaw, [0, 0, MOUTH_Z - JAW_PIVOT_Z], [MOUTH_W * 0.965, 0.1, MOUTH_D * 0.965], -1);
    // the neck, the ribcage, the pelvis
    shell(this.neck, [0, 0.07, 0], [0.05, 0.12, 0.05]);
    shell(this.torso, [0, 0.47, 0], [0.147, 0.2325, 0.117]);
    shell(this.torso, [0, 0.03, 0], [0.134, 0.08, 0.1]);
    // Everything above is kept off the floor.  The legs below are only kept
    // out of things -- the feet belong on the floor, and a squat's knees go
    // wherever the legs are solved to.
    this.clipFloorPts = this.clipPts.length;
    for (let i = 0; i < 2; i++) {
      shell(this.legs[i], [0, -0.23, 0], [0.07, 0.25, 0.07]);
      shell(this.knees[i], [0, -0.24, 0], [0.055, 0.25, 0.055]);
      shell(this.ankles[i], [0, -0.06, 0.1], [0.055, 0.035, 0.16]);
    }
  }

  /**
   * Keep his head, neck and trunk above the floor and out of the solid
   * things round him, AFTER everything else has posed them.
   *
   *   The floor: a part of him under it (his face down at a gap, the eye
   *   nearest the floor on a head rolled over on its side) is lifted by
   *   bringing the trunk back up -- the smallest change that raises
   *   everything above the hips, and the one that keeps the feet and the
   *   hands where they are.
   *
   *   Anything solid: a part of him inside it is pushed straight back out,
   *   the shortest way, by moving the whole body over.  Where he is for the
   *   room does not change; only where he is drawn.
   *
   * The hands are not tested: they are meant to be on things.
   */
  private unclip(pose: FroggyPose): void {
    if (this.climbNow > 0.3) return;
    if (this.clipPts.length === 0) this.buildClipPts();
    const solids = pose.solids ?? null;
    const par = this.root.parent;
    // solids are in his parent's space and so is `s`; the floor is the world's
    const s = this.size;
    const sW = this.sizeW;
    const floor = this.floorY + 0.03 * sW;
    const inv = this.q.copy(this.root.quaternion).invert();
    for (let iter = 0; iter < 4; iter++) {
      this.root.updateMatrixWorld(true);
      let low = Infinity;
      let lowX = 0;
      let lowZ = 0;
      let px = 0;
      let nx = 0;
      let pz = 0;
      let nz = 0;
      // every point, once, in the world and in his parent's space
      const pts = this.clipLoc;
      while (pts.length < this.clipPts.length) pts.push(new THREE.Vector3());
      for (let i = 0; i < this.clipPts.length; i++) {
        const { o, p } = this.clipPts[i];
        const w = o.localToWorld(this.clipW.copy(p));
        if (i < this.clipFloorPts && w.y < low) {
          low = w.y;
          lowX = w.x;
          lowZ = w.z;
        }
        if (par) par.worldToLocal(pts[i].copy(w));
        else pts[i].copy(w);
      }
      // Out of anything solid, a whole shape at a time: for each shape of him
      // (the dome, a cheek, the ribcage...) inside a box, the one side that
      // clears ALL of it with the smallest move.  Point by point, a head wider
      // than a partition is thick was pushed both ways at once and stayed in.
      if (solids) {
        const m = 0.03 * s;
        // where he stands, in the same space as the solids
        const hipAt = this.hips.getWorldPosition(this.tmp6);
        if (par) par.worldToLocal(hipAt);
        for (const b of solids) {
          const y0 = b.y0 ?? -1;
          for (const [from, to] of this.clipRange) {
            let hit = false;
            let minX = Infinity;
            let maxX = -Infinity;
            let minZ = Infinity;
            let maxZ = -Infinity;
            for (let i = from; i < to; i++) {
              const q = pts[i];
              if (q.y >= b.y1 || q.y <= y0) continue;
              if (q.x > b.x0 && q.x < b.x1 && q.z > b.z0 && q.z < b.z1) hit = true;
              // what of it is level with the box, for how far it must go
              if (q.z > b.z0 && q.z < b.z1) {
                minX = Math.min(minX, q.x);
                maxX = Math.max(maxX, q.x);
              }
              if (q.x > b.x0 && q.x < b.x1) {
                minZ = Math.min(minZ, q.z);
                maxZ = Math.max(maxZ, q.z);
              }
            }
            if (!hit) continue;
            // Back out the side his body is on: a head leant half through a
            // thin wall is nearer the far side, and must not be put there.
            const onPX = hipAt.x >= b.x1;
            const onNX = hipAt.x <= b.x0;
            const onPZ = hipAt.z >= b.z1;
            const onNZ = hipAt.z <= b.z0;
            const any = onPX || onNX || onPZ || onNZ;
            const toPX = !any || onPX ? b.x1 - minX + m : Infinity;
            const toNX = !any || onNX ? maxX - b.x0 + m : Infinity;
            const toPZ = !any || onPZ ? b.z1 - minZ + m : Infinity;
            const toNZ = !any || onNZ ? maxZ - b.z0 + m : Infinity;
            const least = Math.min(toPX, toNX, toPZ, toNZ);
            if (least === toPX) px = Math.max(px, toPX);
            else if (least === toNX) nx = Math.max(nx, toNX);
            else if (least === toPZ) pz = Math.max(pz, toPZ);
            else nz = Math.max(nz, toNZ);
          }
        }
      }
      const pen = floor - low;
      const push = this.tmp5.set(px - nx, 0, pz - nz);
      if (pen <= 0.002 && push.lengthSq() < 1e-6) break;
      if (pen > 0.002) {
        // how far the low point is out in front of the waist: the lever the
        // trunk turns it on
        const t = this.torso.getWorldPosition(this.tmp6);
        const lever = Math.max(0.3 * sW, Math.hypot(lowX - t.x, lowZ - t.z));
        // Only ever back toward upright, and never past it: a low point that
        // is not out in front of him is not one straightening up will lift.
        const ahead = (lowX - t.x) * Math.sin(this.root.rotation.y) + (lowZ - t.z) * Math.cos(this.root.rotation.y);
        if (ahead > 0 && this.torso.rotation.x > 0) {
          this.torso.rotation.x = Math.max(0, this.torso.rotation.x - Math.min(0.4, pen / lever + 0.01));
        }
      }
      if (push.lengthSq() > 1e-6) {
        // his parent's space to the body's own: unturned and unscaled
        push.applyQuaternion(inv).divideScalar(s);
        this.hips.position.x += push.x;
        this.hips.position.z += push.z;
      }
    }
  }

  /**
   * Draw the arms out to `arm` times their length and the fingers to
   * `finger` times theirs.  The bones stretch along themselves and not across,
   * so the arm gets longer and no thicker, and everything below each joint
   * moves down with it: the elbow stays on the end of the upper arm and the
   * hand on the end of the forearm.
   */
  /**
   * A variation of him, from a seed: a little more or less stooped, the head
   * sitting a little to one side or the other, the arms hanging a little
   * further out, one eye larger.  Every one of them is the same Froggy -- the
   * model, the face and the colours do not change -- and none of them is the
   * same picture.
   */
  vary(seed: number): void {
    let x = (Math.floor(seed * 9301) % 233280 + 233280) % 233280 || 1;
    const r = (): number => ((x = (x * 9301 + 49297) % 233280) / 233280);
    this.varHunch = r() * 0.22;
    this.varTilt = (r() - 0.5) * 0.22;
    this.varSplay = r() * 0.07;
    const big = 1 + r() * 0.12;
    const which = r() < 0.5 ? 0 : 1;
    if (this.eyes[which]) this.eyes[which].scale.multiplyScalar(big);
    const head = 0.97 + r() * 0.07;
    this.head.scale.multiplyScalar(head);
  }

  private setArmLength(arm: number, finger: number): void {
    if (Math.abs(arm - this.armK) < 1e-4 && Math.abs(finger - this.fingerK) < 1e-4) return;
    this.armK = arm;
    this.fingerK = finger;
    for (let h = 0; h < 2; h++) {
      const p = this.armLen[h];
      if (!p) continue;
      p.upper.scale.y = arm;
      p.upper.position.y = p.upperY * arm;
      this.elbows[h].position.y = -0.57 * arm;
      p.fore[0].scale.y = arm;
      for (let i = 0; i < p.fore.length; i++) p.fore[i].position.y = p.foreY[i] * arm;
      // the wrist, the palm and the roots of the fingers ride down the forearm
      for (let i = 0; i < p.hand.length; i++) p.hand[i].position.y = p.handY[i] - 0.57 * (arm - 1);
      for (const f of this.hands[h]) f.scale.y = finger;
    }
  }

  /**
   * How hard his eyes and teeth catch whatever light there is: 0 as he is
   * in the rooms, 1 in a scare, when the only things you should be able to
   * find in the dark are the two eyes and the teeth.
   */
  setGlare(k: number): void {
    const g = THREE.MathUtils.clamp(k, 0, 1);
    for (const m of this.scleraMats) m.emissiveIntensity = 0.55 + g * 1.1;
    for (const m of this.toothMats) m.emissiveIntensity = 1 + g * 2.6;
  }

  /** Between his eyes, in the world: where a camera looks to meet his stare. */
  faceAt(out: THREE.Vector3): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    const a = this.eyes[0].getWorldPosition(this.tmp);
    const b = this.eyes[1].getWorldPosition(this.tmp2);
    return out.copy(a).add(b).multiplyScalar(0.5);
  }

  /**
   * A small wrong movement of the head, on top of whatever `update` just set:
   * a tick sideways, a jerk of the chin, a tilt that comes from nowhere.  Call
   * it after `update`, every frame it is wanted.  The neck carries it, so the
   * head stays on the body however it moves.
   */
  twitchHead(pitch: number, yaw: number, roll: number): void {
    this.neck.rotation.x += pitch;
    this.neck.rotation.y += yaw;
    this.neck.rotation.z += roll;
  }

  /**
   * Swing each arm outward, as far as it needs, so that seen from `viewer`
   * nothing of it lies over either eye.  The swing is applied first and then
   * measured, and grows while there is still an overlap, so it finds the
   * smallest one that works and holds it.
   */
  private keepEyesClear(viewer: THREE.Vector3 | null, dt: number): void {
    // Only when his face is turned to you: with it turned away -- down behind
    // a counter, into a bin -- there is no stare to keep clear, and swinging an
    // arm out of the way only threw it up in the air.
    if (viewer) {
      this.head.updateWorldMatrix(true, false);
      const fwd = this.tmp.set(0, 0, 1).transformDirection(this.head.matrixWorld);
      const to = this.tmp2.copy(viewer).sub(this.head.getWorldPosition(this.tmp3)).normalize();
      if (fwd.dot(to) < 0.35) viewer = null;
    }
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
    const dart = 1 - this.stillNow;
    for (const eye of this.eyes) {
      let yaw = this.saccade.x * dart;
      let pitch = this.saccade.y * dart;
      if (this.gaze) {
        const local = eye.parent!.worldToLocal(this.gaze.clone());
        local.sub(eye.position);
        yaw = Math.atan2(local.x, local.z) + this.saccade.x * 0.15 * dart;
        pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z)) + this.saccade.y * 0.15 * dart;
      }
      eye.rotation.y += (THREE.MathUtils.clamp(yaw, -0.6, 0.6) - eye.rotation.y) * Math.min(1, dt * 22);
      eye.rotation.x += (THREE.MathUtils.clamp(pitch, -0.5, 0.5) - eye.rotation.x) * Math.min(1, dt * 22);
    }

    // ---- THE PUPILS.  Opening is quick (fear is quick); closing back down
    // is slow, so a scare leaves them wide for a while after.
    const rate = this.dilateWant > this.dilateNow ? 5 : 0.8;
    this.dilateNow += (this.dilateWant - this.dilateNow) * Math.min(1, dt * rate);
    // Constricting is quicker still -- the eyes snapping onto you -- and
    // it wins: a constricted eye is not also a dilated one.
    const crate = this.constrictWant > this.constrictNow ? 9 : 1.2;
    this.constrictNow += (this.constrictWant - this.constrictNow) * Math.min(1, dt * crate);
    if (this.constrictNow > 0.02) {
      const lv = Math.round(this.constrictNow * PUPIL_STEPS);
      if (lv !== this.pinLevel) {
        this.pinLevel = lv;
        this.pupilLevel = -1;
        const g = pinCap(this.constrictNow);
        for (const p of this.pupils) p.geometry = g.pupil;
        for (const r of this.rings) {
          r.geometry = g.ring;
          r.visible = true;
        }
      }
    } else {
      if (this.pinLevel !== -1) {
        this.pinLevel = -1;
        for (const r of this.rings) r.visible = false;
      }
      const level = Math.round(this.dilateNow * PUPIL_STEPS);
      if (level !== this.pupilLevel) {
        this.pupilLevel = level;
        const g = pupilCap(this.dilateNow);
        for (const p of this.pupils) p.geometry = g;
      }
    }

    // ---- THE LIDS.  They ride the eye: the upper one comes down as he looks
    // down and lifts as he looks up, the lower follows less; so the eye is
    // always framed the same way, which is what makes it look alive.  With
    // the pupils blown, the lids part a little -- only a little: a heavy lid
    // over a black eye is the worse of the two.  A blink is
    // quick and rare, and never while he has you -- he does not look away.
    // A constricted stare pulls the lids right back, like fear does.
    const d = Math.max(this.dilateNow, this.constrictNow * 1.2);
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.17) this.blinkT = -1;
    } else if (d < 0.5 && this.stillNow < 0.5) {
      // Rarely.  Something that is watching you does not keep looking away.
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blinkT = 0;
        this.blinkIn = 7 + Math.random() * 8;
      }
    }
    const shut = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.17) * Math.PI) : 0;
    for (let e = 0; e < this.lids.length; e++) {
      const { group, upper, lower } = this.lids[e];
      const eye = this.eyes[e];
      group.rotation.y = eye.rotation.y;
      // heavy: the upper lid sits low over the top of the eye (-0.42 would
      // just clear the pupil); fear lifts it right off
      // A stare does not let the lid follow the eye down: looking down at you
      // from his height, a lid that rode the eye came half over it, and a
      // half-shut eye is sleepy, not hungry.  Staring, the lids stay pulled
      // back whichever way he looks.  And the two sides are not a pair: the
      // left one heavier.
      const stare = Math.min(1, this.constrictNow);
      const follow = eye.rotation.x * (1 - 0.8 * stare);
      const heavy = e === 0 ? 0.05 * (1 - stare) : 0;
      const upOpen = -0.42 - d * 0.3 + follow * 0.8 + heavy;
      const loOpen = 0.62 + d * 0.14 + follow * 0.45;
      upper.rotation.x = upOpen + (0.06 - upOpen) * shut;
      lower.rotation.x = loOpen + (-0.04 - loOpen) * shut;
    }
  }
}
