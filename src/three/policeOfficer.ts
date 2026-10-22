/**
 * ---- A POLICE OFFICER, IN 3D.
 *
 * Built the way the scary Froggy is built -- a hierarchy of shaped meshes on
 * pivots, every pivot a joint, posed fresh each frame from what the officer is
 * doing -- but a person: hips, a spine that leans, a chest that turns, a neck,
 * a head that looks; shoulders, elbows and hands; hips, knees and ankles.
 *
 *   THE UNIFORM is painted, not flat: a navy twill with its weave and its
 *   seams, a button placket and two flapped breast pockets on the shirt,
 *   epaulettes, a crease down the trousers, a black duty belt with its
 *   holster, cuff case, baton and keepers, a radio on the chest with its
 *   coiled lead, a gold shield on the left breast and a name bar on the
 *   right, and boots with a shine on the toe.  Three of them, each a little
 *   different (see OFFICER_LOOKS): a cap or none, a moustache, a ponytail,
 *   a stab vest with POLICE across the back, glasses.
 *
 *   THE FACE is painted onto the head and given depth where depth reads: a
 *   nose, ears, eyes that blink, brows that come down, and a jaw that drops
 *   when they shout.
 *
 *   THE FLASHLIGHT is in the right hand and is a real spot light, cone and
 *   soft edge and fall-off, pointed where the officer is looking; a faint
 *   beam through the air goes with it, cut off where it meets a wall (the
 *   scene says how far that is: see `beamLen`).
 *
 *   THE LIGHT BAR round the shins: a ring of red and blue sweeping round the
 *   lower legs, a glow on the floor under them, and two small coloured lights
 *   circling with it that throw red and blue onto the floor and the walls.
 *
 * Model space: feet at y 0, facing +z, a metre is a metre.
 */

import * as THREE from 'three';

export interface OfficerLook {
  name: string;
  skin: number;
  hair: number;
  cap: boolean;
  mustache: boolean;
  ponytail: boolean;
  vest: boolean;
  glasses: boolean;
  /** A little taller or shorter than 1.8 m. */
  height: number;
  /** Broader or slimmer across the shoulders. */
  build: number;
}

export const OFFICER_LOOKS: OfficerLook[] = [
  { name: 'HALE', skin: 0xd8a888, hair: 0x4a3426, cap: true, mustache: true, ponytail: false, vest: false, glasses: false, height: 1.84, build: 1.06 },
  { name: 'OKAFOR', skin: 0x7a4e34, hair: 0x14100e, cap: false, mustache: false, ponytail: false, vest: true, glasses: false, height: 1.88, build: 1.1 },
  { name: 'REYES', skin: 0xc08a66, hair: 0x2a1a12, cap: true, mustache: false, ponytail: true, vest: false, glasses: true, height: 1.72, build: 0.94 },
];

/** What the officer is doing this frame: the scene decides, the rig shows it. */
export interface OfficerState {
  /** Metres a second over the ground. */
  speed: number;
  run: boolean;
  /** Where the head (and the torch with it) points, relative to the body: radians. */
  aimYaw: number;
  aimPitch: number;
  /** 0..1 down on one knee, the torch low (under a bed). */
  crouch: number;
  /** 0..1 the left hand out to a handle or a curtain. */
  reach: number;
  /** 0..1 the left arm out straight at you. */
  point: number;
  /** 0..1 the mouth open, the brows down. */
  shout: number;
  /** 0..1 both hands forward (the arrest). */
  grab: number;
  /** How far the beam runs before something solid stops it, metres. */
  beamLen: number;
  /** The torch on (0) to off; and how bright the light bar is (0..1). */
  torch: number;
  lights: number;
}

export const IDLE_STATE: OfficerState = {
  speed: 0,
  run: false,
  aimYaw: 0,
  aimPitch: 0,
  crouch: 0,
  reach: 0,
  point: 0,
  shout: 0,
  grab: 0,
  beamLen: 8,
  torch: 1,
  lights: 1,
};

// ------------------------------------------------------------------ textures

function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** A deterministic scatter, so the cloth is the same cloth every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Navy twill: the diagonal of the weave, flecks, and darker where it creases. */
function twill(g: CanvasRenderingContext2D, w: number, h: number, base: string, seed: number): void {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let y = 0; y < h; y += 2) {
    for (let x = (y / 2) % 4; x < w; x += 4) {
      g.fillStyle = `rgba(255,255,255,${0.025 + r() * 0.025})`;
      g.fillRect(x, y, 2, 1);
    }
  }
  for (let k = 0; k < (w * h) / 30; k++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(150,170,210,0.06)';
    g.fillRect(r() * w, r() * h, 1, 1);
  }
}

function seam(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = 'rgba(170,190,230,0.16)';
  g.setLineDash([2, 2]);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0 + 1.5, y0);
  g.lineTo(x1 + 1.5, y1);
  g.stroke();
  g.setLineDash([]);
}

/**
 * The shirt, as it wraps a cylinder facing +z: u 0 (and 1) is the middle of
 * the front, 0.5 the middle of the back.  Placket and buttons down the front,
 * two flapped pockets either side of it, the side seams, a yoke seam across
 * the back, and folds at the waist where it is tucked in.
 */
function shirtTex(vest: boolean, seed: number): THREE.CanvasTexture {
  return canvasTex(512, 256, (g) => {
    twill(g, 512, 256, '#1d2a42', seed);
    // folds at the tuck: soft dark vertical bands at the bottom
    const r = rng(seed + 7);
    for (let k = 0; k < 24; k++) {
      const x = r() * 512;
      const grd = g.createLinearGradient(0, 200, 0, 256);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = grd;
      g.fillRect(x, 200, 3 + r() * 5, 56);
    }
    // side seams (u 0.25 and 0.75) and the yoke across the back
    seam(g, 128, 0, 128, 256);
    seam(g, 384, 0, 384, 256);
    seam(g, 300, 36, 468, 36);
    // the placket, both edges of the texture are the front middle
    for (const x of [0, 512]) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x - 9, 0, 18, 256);
      g.fillStyle = '#22304a';
      g.fillRect(x - 7, 0, 14, 256);
      seam(g, x - 7, 0, x - 7, 256);
      seam(g, x + 6, 0, x + 6, 256);
      for (let y = 24; y < 250; y += 34) {
        g.fillStyle = '#0c1220';
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(200,210,240,0.35)';
        g.fillRect(x - 1, y - 2, 1, 1);
      }
    }
    // the breast pockets with their flaps and buttons
    for (const cx of [52, 460]) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(cx - 26, 40, 52, 58);
      seam(g, cx - 26, 40, cx - 26, 98);
      seam(g, cx + 26, 40, cx + 26, 98);
      seam(g, cx - 26, 98, cx + 26, 98);
      g.fillStyle = '#24324e';
      g.beginPath();
      g.moveTo(cx - 28, 36);
      g.lineTo(cx + 28, 36);
      g.lineTo(cx + 28, 52);
      g.lineTo(cx, 58);
      g.lineTo(cx - 28, 52);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.stroke();
      g.fillStyle = '#0c1220';
      g.beginPath();
      g.arc(cx, 52, 3, 0, Math.PI * 2);
      g.fill();
    }
    if (vest) {
      // the stab vest over it: a flat black panel front and back, its straps,
      // and POLICE across the back in reflective silver
      g.fillStyle = '#101216';
      g.fillRect(0, 10, 150, 210);
      g.fillRect(362, 10, 150, 210);
      g.fillRect(150, 10, 212, 210);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = 14; y < 216; y += 6) g.fillRect(0, y, 512, 1);
      g.fillStyle = '#2a2c30';
      g.fillRect(118, 10, 20, 210);
      g.fillRect(374, 10, 20, 210);
      g.fillStyle = '#c8ccd4';
      g.font = 'bold 44px monospace';
      g.textAlign = 'center';
      g.fillText('POLICE', 256, 118);
      g.fillStyle = '#9aa0aa';
      g.fillRect(170, 136, 172, 8);
      g.font = 'bold 22px monospace';
      g.fillStyle = '#c8ccd4';
      g.fillText('POLICE', 460, 130);
      g.fillText('POLICE', 52, 130);
    }
  });
}

/** Trousers: the same navy a shade darker, a pressed crease front and back. */
function trouserTex(seed: number): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    twill(g, 256, 256, '#151e30', seed);
    for (const x of [0, 128, 256]) {
      g.fillStyle = 'rgba(160,180,220,0.10)';
      g.fillRect(x - 1, 0, 2, 256);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x + 1, 0, 2, 256);
    }
    seam(g, 64, 0, 64, 256);
    seam(g, 192, 0, 192, 256);
    // bunched over the boot
    for (let k = 0; k < 6; k++) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 226 + k * 5, 256, 2);
    }
  });
}

/** The face, painted onto the head's sphere: the middle of the face at u 0.25. */
function faceTex(look: OfficerLook): THREE.CanvasTexture {
  return canvasTex(256, 128, (g) => {
    const skin = new THREE.Color(look.skin);
    const sh = skin.clone().multiplyScalar(0.72);
    const hi = skin.clone().lerp(new THREE.Color(0xffffff), 0.18);
    g.fillStyle = hex(skin.getHex());
    g.fillRect(0, 0, 256, 128);
    // modelling: cheekbones lit, the temples and under the jaw in shadow
    const cx = 64;
    const grd = g.createRadialGradient(cx, 60, 4, cx, 60, 64);
    grd.addColorStop(0, hex(hi.getHex()));
    grd.addColorStop(0.6, hex(skin.getHex()));
    grd.addColorStop(1, hex(sh.getHex()));
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
    // pores and a little colour in the cheeks
    const r = rng(look.skin);
    for (let k = 0; k < 900; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      g.fillRect(r() * 256, r() * 128, 1, 1);
    }
    g.fillStyle = 'rgba(190,70,60,0.12)';
    g.beginPath();
    g.ellipse(cx - 18, 74, 10, 7, 0, 0, Math.PI * 2);
    g.ellipse(cx + 18, 74, 10, 7, 0, 0, Math.PI * 2);
    g.fill();
    // the sockets: shadow round where the eyes go
    g.fillStyle = 'rgba(40,20,10,0.22)';
    g.beginPath();
    g.ellipse(cx - 13, 56, 9, 6, 0, 0, Math.PI * 2);
    g.ellipse(cx + 13, 56, 9, 6, 0, 0, Math.PI * 2);
    g.fill();
    // the mouth line and the lips
    g.fillStyle = hex(new THREE.Color(look.skin).multiplyScalar(0.55).lerp(new THREE.Color(0x902020), 0.25).getHex());
    g.fillRect(cx - 9, 89, 18, 3);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(cx - 8, 90, 16, 1);
    // stubble on the jaw
    if (!look.ponytail) {
      for (let k = 0; k < 500; k++) {
        const a = r() * Math.PI;
        const rr = 30 + r() * 12;
        g.fillStyle = 'rgba(30,20,15,0.10)';
        g.fillRect(cx + Math.cos(a) * rr * 0.9, 74 + Math.sin(a) * rr * 0.55, 1, 1);
      }
    }
    if (look.mustache) {
      g.fillStyle = hex(look.hair);
      g.beginPath();
      g.moveTo(cx - 14, 88);
      g.quadraticCurveTo(cx, 78, cx + 14, 88);
      g.lineTo(cx + 10, 86);
      g.quadraticCurveTo(cx, 82, cx - 10, 86);
      g.closePath();
      g.fill();
    }
    // the hairline on the back and top of the head (the rest of the sphere)
    g.fillStyle = hex(look.hair);
    g.fillRect(128, 0, 128, 70);
    g.fillRect(0, 0, 256, 24);
    g.fillRect(100, 0, 28, 60);
    g.fillRect(0, 0, 28, 60);
    for (let k = 0; k < 400; k++) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(r() * 256, r() * 60, 1, 2);
    }
  });
}

/** The checked band round a police cap. */
function capBandTex(): THREE.CanvasTexture {
  const t = canvasTex(128, 16, (g) => {
    for (let x = 0; x < 128; x += 8) {
      for (let y = 0; y < 16; y += 8) {
        g.fillStyle = (x / 8 + y / 8) % 2 ? '#f2f2f2' : '#101010';
        g.fillRect(x, y, 8, 8);
      }
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** A soft round glow for the light bar and the lens. */
let glowTex: THREE.CanvasTexture | null = null;
function glow(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  glowTex = canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
  return glowTex;
}

/** The floor under them: red one side, blue the other, fading out at the rim. */
function floorRingTex(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const dx = x - 64;
        const dy = y - 64;
        const d = Math.hypot(dx, dy) / 64;
        const a = Math.atan2(dy, dx);
        const fall = d > 1 ? 0 : Math.max(0, 1 - Math.abs(d - 0.55) / 0.45);
        const red = Math.max(0, Math.cos(a)) ** 2;
        const blue = Math.max(0, -Math.cos(a)) ** 2;
        const i = (y * 128 + x) * 4;
        img.data[i] = 255 * red;
        img.data[i + 1] = 40 * (red + blue);
        img.data[i + 2] = 255 * blue;
        img.data[i + 3] = 255 * fall * (red + blue);
      }
    }
    g.putImageData(img, 0, 0);
  });
}

/** The beam through the air: bright at the lens, nothing at the far end. */
let beamTex: THREE.CanvasTexture | null = null;
function beamAlpha(): THREE.CanvasTexture {
  if (beamTex) return beamTex;
  beamTex = canvasTex(4, 128, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 128);
  });
  return beamTex;
}

// ------------------------------------------------------------------ the rig

interface Limb {
  /** The joint at the top. */
  pivot: THREE.Group;
  /** The joint in the middle (elbow, knee). */
  mid: THREE.Group;
  /** The joint at the end (wrist, ankle). */
  end: THREE.Group;
}

export class PoliceOfficer {
  readonly root = new THREE.Group();
  readonly look: OfficerLook;
  /** The torch's light, and the point it is aimed at. */
  readonly torch: THREE.SpotLight;
  private torchTarget = new THREE.Object3D();
  private beam: THREE.Mesh;
  private lens: THREE.Sprite;
  /** The light bar's two lamps, and everything that turns with it. */
  private bar = new THREE.Group();
  private barLamps: THREE.PointLight[] = [];
  private barDots: THREE.Sprite[] = [];
  private floorRing: THREE.Mesh;

  private pelvis = new THREE.Group();
  private spine = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private jaw = new THREE.Group();
  private lids: THREE.Mesh[] = [];
  private brows: THREE.Mesh[] = [];
  private armL: Limb;
  private armR: Limb;
  private legL: Limb;
  private legR: Limb;
  private torchBody = new THREE.Group();

  private phase = 0;
  private blinkT = 2;
  private lightT = Math.random() * 10;
  private s: OfficerState = { ...IDLE_STATE };
  /** A foot coming down: where (world), which. */
  onFootfall: ((at: THREE.Vector3, run: boolean) => void) | null = null;

  private readonly H: number;

  constructor(look: OfficerLook, seed = 1) {
    this.look = look;
    this.H = look.height / 1.8;
    const k = this.H;
    const b = look.build;

    // ---- materials
    const shirt = new THREE.MeshLambertMaterial({ map: shirtTex(look.vest, seed) });
    const sleeve = new THREE.MeshLambertMaterial({ map: shirtTex(false, seed + 3) });
    const trousers = new THREE.MeshLambertMaterial({ map: trouserTex(seed + 5) });
    const leather = new THREE.MeshPhongMaterial({ color: 0x0e0e10, specular: 0x3a3a40, shininess: 40 });
    const boot = new THREE.MeshPhongMaterial({ color: 0x08080a, specular: 0x6a6a74, shininess: 90 });
    const metal = new THREE.MeshPhongMaterial({ color: 0x2a2c30, specular: 0x9a9aa4, shininess: 70 });
    const gold = new THREE.MeshPhongMaterial({ color: 0xc8a040, specular: 0xfff0b0, shininess: 100, emissive: 0x2a1e06 });
    const silver = new THREE.MeshPhongMaterial({ color: 0xc8ccd4, specular: 0xffffff, shininess: 90 });
    const skin = new THREE.MeshPhongMaterial({ color: look.skin, specular: 0x2a2018, shininess: 12 });
    const face = new THREE.MeshPhongMaterial({ map: faceTex(look), specular: 0x2a2018, shininess: 14 });
    const hair = new THREE.MeshLambertMaterial({ color: look.hair });
    const white = new THREE.MeshPhongMaterial({ color: 0xf0ece4, shininess: 60, specular: 0x606060 });
    const iris = new THREE.MeshPhongMaterial({ color: 0x2a1a10, shininess: 90, specular: 0xffffff });
    const mouth = new THREE.MeshBasicMaterial({ color: 0x2a0c0c });
    const teeth = new THREE.MeshPhongMaterial({ color: 0xe8e0d0, shininess: 40 });
    const navyCap = new THREE.MeshLambertMaterial({ color: 0x141c2e });
    const glassM = new THREE.MeshPhongMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.25, shininess: 120, specular: 0xffffff });

    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    };

    this.root.add(this.pelvis);
    this.pelvis.position.y = 0.97 * k;

    // ---- the hips and the duty belt
    const hips = mesh(new THREE.CylinderGeometry(0.17 * b, 0.16 * b, 0.2, 18), trousers, this.pelvis, 0, -0.04, 0);
    hips.scale.z = 0.72;
    const belt = mesh(new THREE.CylinderGeometry(0.18 * b, 0.18 * b, 0.07, 22, 1, true), leather, this.pelvis, 0, 0.04, 0);
    belt.scale.z = 0.74;
    mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), silver, this.pelvis, 0, 0.04, 0.135 * b);
    // the holster on the right hip, the cuff case and keepers, the baton on the left
    const holster = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.12), leather, this.pelvis, -0.19 * b, -0.05, 0.0);
    holster.rotation.z = 0.08;
    mesh(new THREE.BoxGeometry(0.05, 0.06, 0.07), leather, this.pelvis, -0.12 * b, 0.02, -0.11 * b);
    mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), leather, this.pelvis, 0.09 * b, 0.03, 0.11 * b);
    mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), leather, this.pelvis, -0.08 * b, 0.03, 0.12 * b);
    const baton = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 8), metal, this.pelvis, 0.2 * b, -0.16, -0.02);
    baton.rotation.z = -0.12;

    // ---- the spine and the chest
    this.pelvis.add(this.spine);
    this.spine.position.y = 0.06;
    const waist = mesh(new THREE.CylinderGeometry(0.19 * b, 0.17 * b, 0.3 * k, 20), shirt, this.spine, 0, 0.15 * k, 0);
    waist.scale.z = 0.68;
    this.spine.add(this.chest);
    this.chest.position.y = 0.3 * k;
    const torso = mesh(new THREE.CylinderGeometry(0.23 * b, 0.19 * b, 0.28 * k, 22), shirt, this.chest, 0, 0.12 * k, 0);
    torso.scale.z = 0.62;
    // the shoulders, rounded
    for (const sx of [-1, 1]) {
      const sh = mesh(new THREE.SphereGeometry(0.075 * b, 14, 10), sleeve, this.chest, sx * 0.2 * b, 0.24 * k, 0);
      sh.scale.set(1.1, 0.85, 0.95);
      // the epaulette
      const ep = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.13), navyCap, this.chest, sx * 0.18 * b, 0.285 * k, 0);
      ep.rotation.z = sx * -0.25;
      mesh(new THREE.SphereGeometry(0.008, 6, 4), silver, this.chest, sx * 0.205 * b, 0.284 * k, 0.05);
    }
    // the badge: a gold shield on the left breast; the name bar on the right
    {
      const s = new THREE.Shape();
      s.moveTo(0, 0.04);
      s.lineTo(0.028, 0.03);
      s.lineTo(0.03, -0.005);
      s.quadraticCurveTo(0.02, -0.03, 0, -0.042);
      s.quadraticCurveTo(-0.02, -0.03, -0.03, -0.005);
      s.lineTo(-0.028, 0.03);
      s.closePath();
      const sg = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
      const badge = mesh(sg, gold, this.chest, 0.095 * b, 0.17 * k, 0.142 * b);
      badge.rotation.y = 0.3;
      const star = mesh(new THREE.CircleGeometry(0.01, 5), new THREE.MeshPhongMaterial({ color: 0x8a6a20, shininess: 60 }), this.chest, 0.097 * b, 0.172 * k, 0.153 * b);
      star.rotation.y = 0.3;
      const tag = mesh(new THREE.BoxGeometry(0.06, 0.014, 0.004), silver, this.chest, -0.095 * b, 0.16 * k, 0.142 * b);
      tag.rotation.y = -0.3;
    }
    // the radio on the left shoulder strap, its aerial and its coiled lead
    {
      const radio = new THREE.Group();
      radio.position.set(0.12 * b, 0.235 * k, 0.12 * b);
      radio.rotation.set(-0.2, 0.35, 0);
      this.chest.add(radio);
      mesh(new THREE.BoxGeometry(0.05, 0.085, 0.03), metal, radio);
      mesh(new THREE.BoxGeometry(0.036, 0.03, 0.002), new THREE.MeshBasicMaterial({ color: 0x3a6a3a }), radio, 0, 0.015, 0.016);
      mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.09, 6), leather, radio, 0.015, 0.085, 0);
      const coil = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            Array.from({ length: 40 }, (_, i) => {
              const t = i / 39;
              return new THREE.Vector3(Math.cos(t * 40) * 0.008, -0.04 - t * 0.14, Math.sin(t * 40) * 0.008 - t * 0.02);
            }),
          ),
          80,
          0.0025,
          4,
        ),
        leather,
      );
      radio.add(coil);
    }
    if (look.vest) {
      const v = mesh(new THREE.CylinderGeometry(0.245 * b, 0.215 * b, 0.42 * k, 22, 1, true), new THREE.MeshLambertMaterial({ color: 0x121418, side: THREE.DoubleSide }), this.chest, 0, 0.05 * k, 0);
      v.scale.z = 0.66;
      // POLICE on the back
      const lbl = canvasTex(128, 32, (g) => {
        g.fillStyle = '#121418';
        g.fillRect(0, 0, 128, 32);
        g.fillStyle = '#d8dce4';
        g.font = 'bold 26px monospace';
        g.textAlign = 'center';
        g.fillText('POLICE', 64, 25);
      });
      const back = mesh(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshLambertMaterial({ map: lbl }), this.chest, 0, 0.14 * k, -0.152 * b);
      back.rotation.y = Math.PI;
    }

    // ---- the neck and the head
    this.chest.add(this.neck);
    this.neck.position.y = 0.3 * k;
    mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 12), skin, this.neck, 0, 0.03, 0);
    // the collar round it
    const collar = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 16, 1, true), new THREE.MeshLambertMaterial({ color: 0x1d2a42, side: THREE.DoubleSide }), this.neck, 0, -0.005, 0);
    collar.scale.z = 0.85;
    this.neck.add(this.head);
    this.head.position.y = 0.16;
    const skull = mesh(new THREE.SphereGeometry(0.105, 28, 20), face, this.head, 0, 0, 0);
    skull.scale.set(0.92, 1.12, 1.0);
    // the jaw, its chin, and the mouth that opens
    this.head.add(this.jaw);
    this.jaw.position.set(0, -0.055, 0.02);
    const chin = mesh(new THREE.SphereGeometry(0.07, 18, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), skin, this.jaw, 0, 0.01, 0.0);
    chin.scale.set(1.05, 0.9, 1.1);
    // the mouth: a dark oval, a line shut, open round when they shout
    const mouthIn = mesh(new THREE.CircleGeometry(0.019, 16), mouth, this.head, 0, -0.061, 0.1);
    mouthIn.rotation.x = -0.15;
    mouthIn.name = 'mouth';
    mesh(new THREE.BoxGeometry(0.034, 0.006, 0.006), teeth, this.head, 0, -0.053, 0.099);
    // the nose and the ears
    const nose = mesh(new THREE.ConeGeometry(0.016, 0.045, 8), skin, this.head, 0, -0.01, 0.105);
    nose.rotation.x = Math.PI / 2 - 0.35;
    mesh(new THREE.SphereGeometry(0.012, 8, 6), skin, this.head, 0, -0.03, 0.112);
    for (const sx of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.022, 10, 8), skin, this.head, sx * 0.097, -0.005, 0.0);
      ear.scale.set(0.4, 1, 0.75);
      // the eyes: a white, an iris, a lid that comes down to blink
      const eye = mesh(new THREE.SphereGeometry(0.014, 12, 10), white, this.head, sx * 0.034, 0.012, 0.088);
      eye.scale.z = 0.6;
      mesh(new THREE.SphereGeometry(0.0075, 10, 8), iris, this.head, sx * 0.034, 0.012, 0.097);
      const lid = mesh(new THREE.SphereGeometry(0.0155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), face, this.head, sx * 0.034, 0.012, 0.089);
      lid.rotation.x = -0.9;
      this.lids.push(lid);
      const brow = mesh(new THREE.BoxGeometry(0.03, 0.007, 0.01), hair, this.head, sx * 0.036, 0.034, 0.1);
      brow.rotation.z = sx * -0.12;
      this.brows.push(brow);
      if (look.glasses) {
        const rim = mesh(new THREE.TorusGeometry(0.018, 0.0022, 6, 16), metal, this.head, sx * 0.035, 0.012, 0.106);
        rim.scale.y = 0.8;
        mesh(new THREE.CircleGeometry(0.017, 14), glassM, this.head, sx * 0.035, 0.012, 0.106);
        const arm = mesh(new THREE.BoxGeometry(0.002, 0.002, 0.09), metal, this.head, sx * 0.092, 0.016, 0.06);
        arm.rotation.y = sx * 0.1;
      }
    }
    if (look.glasses) mesh(new THREE.BoxGeometry(0.018, 0.003, 0.003), metal, this.head, 0, 0.016, 0.107);
    // hair: cropped close round the back and sides, a ponytail for one
    const crop = mesh(new THREE.SphereGeometry(0.11, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, this.head, 0, 0.012, -0.008);
    crop.scale.set(0.95, 1.1, 1.0);
    crop.rotation.x = -0.35;
    if (look.ponytail) {
      const bun = mesh(new THREE.SphereGeometry(0.04, 12, 10), hair, this.head, 0, -0.01, -0.11);
      bun.scale.set(1, 0.9, 0.8);
      const tail = mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), hair, this.head, 0, -0.09, -0.12);
      tail.rotation.x = 0.25;
    }
    if (look.cap) {
      const cap = new THREE.Group();
      cap.position.set(0, 0.085, 0.005);
      cap.rotation.x = -0.08;
      this.head.add(cap);
      mesh(new THREE.CylinderGeometry(0.118, 0.108, 0.07, 24), navyCap, cap, 0, 0.03, 0);
      const crown = mesh(new THREE.CylinderGeometry(0.13, 0.118, 0.025, 24), navyCap, cap, 0, 0.075, -0.005);
      crown.scale.z = 1.08;
      const band = mesh(new THREE.CylinderGeometry(0.119, 0.119, 0.032, 24, 1, true), new THREE.MeshLambertMaterial({ map: capBandTex() }), cap, 0, 0.012, 0);
      band.scale.z = 1.0;
      const brim = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 20, 1, false, -Math.PI / 2, Math.PI), leather, cap, 0, -0.012, 0.1);
      brim.scale.set(1.2, 1, 0.8);
      brim.rotation.x = 0.18;
      mesh(new THREE.CircleGeometry(0.02, 12), gold, cap, 0, 0.04, 0.121);
    } else {
      // short hair on top, and a fade
      const top = mesh(new THREE.SphereGeometry(0.108, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), hair, this.head, 0, 0.022, 0.0);
      top.scale.set(0.95, 1.12, 1.02);
    }

    // ---- the arms
    const arm = (sx: number): Limb => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.215 * b, 0.235 * k, 0);
      this.chest.add(pivot);
      const ua = mesh(new THREE.CapsuleGeometry(0.048 * b, 0.22 * k, 4, 12), sleeve, pivot, 0, -0.14 * k, 0);
      ua.scale.z = 0.92;
      const mid = new THREE.Group();
      mid.position.y = -0.29 * k;
      pivot.add(mid);
      mesh(new THREE.CapsuleGeometry(0.04 * b, 0.2 * k, 4, 12), sleeve, mid, 0, -0.12 * k, 0);
      // the cuff, and the hand
      mesh(new THREE.CylinderGeometry(0.044 * b, 0.044 * b, 0.03, 12), new THREE.MeshLambertMaterial({ color: 0x18233a }), mid, 0, -0.23 * k, 0);
      const end = new THREE.Group();
      end.position.y = -0.255 * k;
      mid.add(end);
      const hand = mesh(new THREE.BoxGeometry(0.05, 0.085, 0.03), skin, end, 0, -0.045, 0.005);
      hand.scale.set(1, 1, 1.2);
      mesh(new THREE.CapsuleGeometry(0.011, 0.03, 2, 6), skin, end, sx * -0.03, -0.035, 0.02).rotation.z = sx * 0.6;
      return { pivot, mid, end };
    };
    this.armL = arm(1);
    this.armR = arm(-1);
    // the torch, in the right hand, pointing down the forearm
    this.armR.end.add(this.torchBody);
    // (pointing on down the forearm: out in front when the arm is raised)
    this.torchBody.position.set(0, -0.07, 0.03);
    this.torchBody.rotation.x = Math.PI / 2;
    {
      const body = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12), metal, this.torchBody, 0, 0, 0);
      body.rotation.x = Math.PI / 2;
      const head = mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 14), metal, this.torchBody, 0, 0, 0.13);
      head.rotation.x = Math.PI / 2;
      mesh(new THREE.CircleGeometry(0.026, 14), new THREE.MeshBasicMaterial({ color: 0xfff8e0 }), this.torchBody, 0, 0, 0.156);
      // grip knurling
      for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(0.019, 0.002, 4, 12), leather, this.torchBody, 0, 0, -0.06 + i * 0.025);
    }
    this.lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xfff4d8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.lens.scale.setScalar(0.22);
    this.lens.position.set(0, 0, 0.17);
    this.torchBody.add(this.lens);
    this.torch = new THREE.SpotLight(0xfff2d8, 38, 13, 0.36, 0.55, 1.6);
    this.torch.position.set(0, 0, 0.16);
    this.torchBody.add(this.torch);
    this.torchTarget.position.set(0, 0, 4);
    this.torchBody.add(this.torchTarget);
    this.torch.target = this.torchTarget;
    this.torch.shadow.camera.near = 0.1;
    this.torch.shadow.camera.far = 14;
    // the beam: a cone from the lens, faint, fading out along its length
    const cone = new THREE.ConeGeometry(Math.tan(0.36) * 1, 1, 24, 1, true);
    cone.translate(0, -0.5, 0);
    cone.rotateX(-Math.PI / 2);
    this.beam = new THREE.Mesh(
      cone,
      new THREE.MeshBasicMaterial({ color: 0xfff0d0, alphaMap: beamAlpha(), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.beam.position.set(0, 0, 0.16);
    this.beam.renderOrder = 5;
    this.beam.userData.noShadow = true;
    this.torchBody.add(this.beam);

    // ---- the legs
    const leg = (sx: number): Limb => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.09 * b, -0.06, 0);
      this.pelvis.add(pivot);
      mesh(new THREE.CapsuleGeometry(0.075 * b, 0.32 * k, 4, 12), trousers, pivot, 0, -0.22 * k, 0);
      const mid = new THREE.Group();
      mid.position.y = -0.44 * k;
      pivot.add(mid);
      mesh(new THREE.CapsuleGeometry(0.06 * b, 0.32 * k, 4, 12), trousers, mid, 0, -0.2 * k, 0);
      const end = new THREE.Group();
      end.position.y = -0.42 * k;
      mid.add(end);
      // the boot: its shaft, the foot, a sole, a shine on the toe
      mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.12, 12), boot, end, 0, 0.0, 0);
      const foot = mesh(new THREE.CapsuleGeometry(0.048, 0.14, 4, 10), boot, end, 0, -0.06, 0.06);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.05, 1, 0.8);
      mesh(new THREE.BoxGeometry(0.1, 0.02, 0.26), leather, end, 0, -0.095, 0.06);
      return { pivot, mid, end };
    };
    this.legL = leg(1);
    this.legR = leg(-1);

    // ---- the light bar round the shins
    this.root.add(this.bar);
    this.bar.position.y = 0.28;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const red = i < n / 2;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: red ? 0xff2030 : 0x2050ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      const a = (i / n) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
      s.scale.setScalar(0.16);
      this.bar.add(s);
      this.barDots.push(s);
    }
    for (const [col, a] of [
      [0xff2030, 0],
      [0x2a50ff, Math.PI],
    ] as const) {
      const l = new THREE.PointLight(col, 3.2, 3.6, 2);
      l.position.set(Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36);
      this.bar.add(l);
      this.barLamps.push(l);
    }
    this.floorRing = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: floorRingTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }),
    );
    this.floorRing.rotation.x = -Math.PI / 2;
    this.floorRing.position.y = 0.015;
    this.floorRing.renderOrder = 4;
    this.floorRing.userData.noShadow = true;
    this.root.add(this.floorRing);

    // (the beam is scaled to where it meets a wall, the ring and the glows
    // are flat: none of them is culled on a box it has outgrown)
    for (const o of [this.beam, this.floorRing, this.lens, ...this.barDots]) o.frustumCulled = false;
  }

  setPose(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  /** Where the eyes are, in the world. */
  eyeWorld(out = new THREE.Vector3()): THREE.Vector3 {
    this.head.updateWorldMatrix(true, false);
    return out.set(0, 0.01, 0.06).applyMatrix4(this.head.matrixWorld);
  }

  /** The head's centre, in the world (the scare frames on it). */
  headWorld(out = new THREE.Vector3()): THREE.Vector3 {
    this.head.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.head.matrixWorld);
  }

  /** The torch: where the light leaves it, and which way. */
  torchRay(pos = new THREE.Vector3(), dir = new THREE.Vector3()): { pos: THREE.Vector3; dir: THREE.Vector3 } {
    this.torchBody.updateWorldMatrix(true, false);
    pos.set(0, 0, 0.16).applyMatrix4(this.torchBody.matrixWorld);
    dir.set(0, 0, 1).transformDirection(this.torchBody.matrixWorld);
    return { pos, dir };
  }

  /** Pose the rig for this frame. */
  update(dt: number, st: OfficerState): void {
    const s = this.s;
    // everything eases towards what it should be: nothing snaps
    const ease = (a: number, b: number, rate: number) => a + (b - a) * Math.min(1, dt * rate);
    s.speed = st.speed;
    s.run = st.run;
    s.aimYaw = ease(s.aimYaw, st.aimYaw, 7);
    s.aimPitch = ease(s.aimPitch, st.aimPitch, 7);
    s.crouch = ease(s.crouch, st.crouch, 5);
    s.reach = ease(s.reach, st.reach, 8);
    s.point = ease(s.point, st.point, 8);
    s.shout = ease(s.shout, st.shout, 12);
    s.grab = ease(s.grab, st.grab, 10);
    s.beamLen = st.beamLen;
    s.torch = ease(s.torch, st.torch, 8);
    s.lights = ease(s.lights, st.lights, 4);

    // ---- the stride
    const stride = s.run ? 2.1 : 1.35;
    const was = this.phase;
    this.phase += ((s.speed * dt) / stride) * Math.PI * 2;
    const go = Math.min(1, s.speed / (s.run ? 3 : 1.1));
    const amp = (s.run ? 0.78 : 0.42) * go;
    const ph = this.phase;
    const swingL = Math.sin(ph) * amp;
    const swingR = Math.sin(ph + Math.PI) * amp;
    const kneeOf = (p: number) => (0.12 + (s.run ? 1.05 : 0.6) * Math.max(0, Math.sin(p - 0.6))) * go;
    // a foot down every half stride
    if (Math.floor(was / Math.PI) !== Math.floor(ph / Math.PI) && go > 0.15) {
      const foot = Math.floor(ph / Math.PI) % 2 ? this.legL.end : this.legR.end;
      foot.updateWorldMatrix(true, false);
      const at = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
      at.y = this.root.position.y;
      this.onFootfall?.(at, s.run);
    }

    // ---- the body
    const c = s.crouch;
    const k = this.H;
    const bob = Math.abs(Math.cos(ph)) * (s.run ? 0.05 : 0.025) * go;
    this.pelvis.position.y = (0.97 - 0.42 * c) * k + bob;
    this.pelvis.rotation.y = Math.sin(ph) * 0.08 * go;
    this.pelvis.rotation.z = Math.cos(ph) * 0.03 * go;
    const lean = (s.run ? 0.24 : 0.05) * go + 0.38 * c + 0.12 * s.grab;
    this.spine.rotation.x = lean;
    this.spine.rotation.y = -this.pelvis.rotation.y;
    // the chest turns some of the way with the look, the head the rest
    const yaw = Math.max(-1.3, Math.min(1.3, s.aimYaw));
    this.chest.rotation.y = yaw * 0.35;
    this.chest.rotation.x = -lean * 0.3;
    this.neck.rotation.y = yaw * 0.65;
    this.head.rotation.x = -s.aimPitch * 0.6 - (lean - 0.05) * 0.5;

    // ---- the legs: walking, or one knee down
    if (c > 0.02) {
      // right knee on the floor, left foot planted forward
      const w = c;
      this.legL.pivot.rotation.x = swingL * (1 - w) - 1.35 * w;
      this.legL.mid.rotation.x = kneeOf(ph) * (1 - w) + 1.45 * w;
      this.legR.pivot.rotation.x = swingR * (1 - w) - 0.15 * w;
      this.legR.mid.rotation.x = kneeOf(ph + Math.PI) * (1 - w) + 2.0 * w;
    } else {
      this.legL.pivot.rotation.x = -swingL;
      this.legL.mid.rotation.x = kneeOf(ph);
      this.legR.pivot.rotation.x = -swingR;
      this.legR.mid.rotation.x = kneeOf(ph + Math.PI);
    }
    for (const l of [this.legL, this.legR]) l.end.rotation.x = -(l.pivot.rotation.x + l.mid.rotation.x) * 0.6;

    // ---- the arms.  The right holds the torch out where the head looks; the
    // left swings, or reaches for a handle, or points, or grabs.
    const aimUp = -s.aimPitch;
    this.armR.pivot.rotation.x = -1.25 + aimUp * 0.9;
    this.armR.pivot.rotation.y = yaw * 0.5;
    this.armR.pivot.rotation.z = 0.12;
    this.armR.mid.rotation.x = -0.35 + 0.2 * c;
    this.armR.end.rotation.x = 0.05;
    const swingArm = swingR * 0.9;
    const reach = Math.max(s.reach, s.point, s.grab);
    this.armL.pivot.rotation.x = -swingArm * (1 - reach) + (-1.45 + aimUp * 0.4) * reach;
    this.armL.pivot.rotation.z = -0.1 * (1 - reach) - 0.05 * reach;
    this.armL.pivot.rotation.y = 0.25 * s.reach - 0.1 * s.point;
    this.armL.mid.rotation.x = (-0.3 - (s.run ? 0.9 : 0.15) * go) * (1 - reach) - 0.12 * reach;

    // ---- the face: shouting, blinking, scowling
    this.jaw.rotation.x = s.shout * 0.35;
    const m = this.head.getObjectByName('mouth');
    if (m) m.scale.set(1 - s.shout * 0.15, 0.16 + s.shout * 0.95, 1);
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 1 : 0;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    for (const lid of this.lids) lid.rotation.x = -0.9 + blink * 1.0 + s.shout * -0.15;
    for (const [i, br] of this.brows.entries()) {
      br.position.y = 0.034 - s.shout * 0.006;
      br.rotation.z = (i ? -1 : 1) * (0.12 + s.shout * 0.3);
    }

    // ---- the torch and its beam
    this.torch.intensity = 38 * s.torch;
    this.lens.material.opacity = s.torch;
    this.beam.visible = s.torch > 0.05;
    const len = Math.max(0.2, Math.min(9, s.beamLen));
    this.beam.scale.set(len, len, len);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.085 * s.torch;

    // ---- the light bar: round and round, red and blue
    this.lightT += dt;
    this.bar.rotation.y = this.lightT * 5.5;
    const flash = 0.75 + 0.25 * Math.sin(this.lightT * 19);
    for (const [i, d] of this.barDots.entries()) {
      const a = (i / this.barDots.length) * Math.PI * 2 + this.lightT * 5.5;
      const front = 0.55 + 0.45 * Math.cos(a * 2);
      d.material.opacity = s.lights * front * flash;
    }
    for (const l of this.barLamps) l.intensity = 3.2 * s.lights * flash;
    this.floorRing.rotation.z = -this.lightT * 5.5;
    (this.floorRing.material as THREE.MeshBasicMaterial).opacity = 0.55 * s.lights * flash;
    // crouched, the ring comes down with the shins
    this.bar.position.y = 0.28 - 0.1 * c;
  }

  setVisible(on: boolean): void {
    this.root.visible = on;
  }
}
