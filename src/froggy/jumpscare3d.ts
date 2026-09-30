/**
 * BEING CAUGHT, IN THE ROOM, BY THE THING THAT CAUGHT YOU.
 *
 * The scare used to be a flat drawing painted over the 3D -- a different
 * creature from the one that had been walking the room, arriving from nowhere
 * in a pose that was not his.  It is the model now: the same long, thin body,
 * the same face, the same skin, put in front of the camera and driven there,
 * so the last thing you see is exactly the thing that was hunting you.
 *
 * THE SHAPE OF IT, in the 1.2 seconds it has (SCARE_MS, which the scenes
 * already wait out):
 *
 *   THE HOLD.  No cut, no fade, nothing that warns you: on the frame he
 *   reaches you he is simply THERE, a couple of body-widths off, looking down
 *   at you with his head higher than yours.  The eyes are already on you.
 *
 *   THE LUNGE.  He comes at the camera -- not a zoom, a rush that is still
 *   accelerating when it arrives -- folding down into your face, the long
 *   arms coming up and forward into the edges of the frame.
 *
 *   THE CLOSE.  His face fills the screen, lit from underneath by something
 *   cold, and it is alive: the head makes small wrong adjustments, the eyes
 *   dart and come back to you, the breath catches, the jaw parts a crack.
 *   Nothing hides the face -- no smears, no blur -- because the face is the
 *   scare.  The frame closes in and goes red at the very end.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { audio } from '../core/audio';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { ThreeStage } from '../render/threeStage';
import type { FroggyMonster } from '../three/froggyMonster';
import { SCARE_MS } from './jumpscare';

/**
 * FASTER, BECAUSE A SCARE IS A SHOCK AND NOT A REVEAL.  The hold is under a
 * tenth of a second -- long enough to register that something is there and
 * not long enough to read what -- and the lunge is a hundred and forty
 * milliseconds of a thing coming at the lens still accelerating.
 */
export const HOLD_MS = 60;
const LUNGE_MS = 120;

export interface Scare3D {
  /** Call every frame AFTER the scene has placed its camera and its monster. */
  update(dt: number): void;
}

export function playJumpscare3D(scene: Phaser.Scene, stage: ThreeStage, monster: FroggyMonster): Scare3D {
  audio.scare();
  audio.sfx('boom', 1);
  // The recorded scream is already going (see `audio.scare`); the synthetic
  // screech is only for when it could not be loaded.
  const recorded = audio.screamReady();
  scene.time.delayedCall(HOLD_MS, () => {
    audio.sfx('death_stinger', 1);
    if (!recorded) audio.sfx('froggy_screech', 1);
  });
  // THE HIT: a spike of everything at once as he arrives -- a second boom
  // and a second screech on top of the first, and the buzzer under them.
  scene.time.delayedCall(HOLD_MS + LUNGE_MS, () => {
    audio.sfx('boom', 1);
    audio.scare();
    audio.sfx('buzzer', 0.8);
  });

  const cam = stage.camera;
  const s = monster.size;
  // Where the camera was looking when he found you.  The scare happens down
  // that line, and the camera does not get to look away.
  const basePos = cam.position.clone();
  const baseQuat = cam.quaternion.clone();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(baseQuat);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  // He faces back down that line, at you.
  const yaw = Math.atan2(-fwd.x, -fwd.z);

  // How big his face is, so "fills the screen" is measured rather than typed.
  // Distances are to the middle of his head; the muzzle stands `faceFront`
  // proud of that, and it is the muzzle the camera must not end up inside.
  const headSize = 0.46 * 1.14 * s;
  const faceFront = 0.28 * s;
  const fov = THREE.MathUtils.degToRad(cam.fov);
  const view = (d: number) => 2 * d * Math.tan(fov / 2);
  // close: the head a little bigger than the frame -- the eyes at the top
  // edge, the stretched jaw off the bottom of it, the teeth across the middle
  const near = faceFront + headSize / (view(1) * 1.18);
  // far: his head, his chest and his hanging arms, towering
  const far = faceFront + (headSize * 2.5) / view(1);

  // ---- THE LIGHT.  Something cold from underneath and in front, which is
  // the one angle a face is never lit from; a dim red behind him; and the
  // camera's own torch left as it was.
  const under = new THREE.PointLight(0xc6d2df, 0, 6, 1.4);
  const behind = new THREE.PointLight(0x7a0c0c, 0, 8, 1.6);
  stage.scene.add(under, behind);
  // The lamps the player carries are tuned for a room, not for a face a
  // hand's width away, and would burn it to a white disc.  They are turned
  // down as he comes in, so the skin stays skin all the way to the end.
  const carried: [THREE.Light, number][] = [];
  cam.traverse((o) => {
    if ((o as THREE.Light).isLight) carried.push([o as THREE.Light, (o as THREE.Light).intensity]);
  });
  // ---- THE PICTURE JOLTS.  A brief distortion of the 3D canvas itself at
  // the moment he arrives -- blown contrast, a skew, a lurch in scale -- then
  // straight back.  It is a CSS filter, so nothing in the room is touched.
  const canvas = document.getElementById('three-canvas') as HTMLCanvasElement | null;
  const hitAt = HOLD_MS + LUNGE_MS;
  const distort = (k: number): void => {
    if (!canvas) return;
    if (k <= 0) {
      canvas.style.filter = '';
      canvas.style.transform = '';
      return;
    }
    const j = (Math.random() - 0.5) * 2;
    canvas.style.filter = `contrast(${1 + 0.9 * k}) saturate(${1 + 0.8 * k}) brightness(${1 + 0.35 * k})`;
    canvas.style.transform = `scale(${1 + 0.07 * k}) skewX(${(j * 3.5 * k).toFixed(2)}deg) translate(${(j * 6 * k).toFixed(1)}px, ${(-j * 4 * k).toFixed(1)}px)`;
  };
  let done = false;
  // the eyes and the teeth are the last things the dark takes
  monster.setGlare(1);
  const dispose = (): void => {
    if (done) return;
    done = true;
    monster.setGlare(0);
    distort(0);
    stage.scene.remove(under, behind);
    for (const [l, i] of carried) l.intensity = i;
  };
  scene.time.delayedCall(SCARE_MS + 650, dispose);

  monster.setVisible(true);
  monster.lookAt(basePos);

  let t = 0;
  let flick = -1;
  // small wrong adjustments of the head, held between snaps
  const jit = new THREE.Euler();
  const jitWant = new THREE.Euler();
  let jitIn = 0;
  const shakeRot = new THREE.Euler();
  const headWorld = new THREE.Vector3();
  const target = new THREE.Vector3();

  const paint = (): void => {
    froggyLayer.paint((ctx) => {
      // NO BLACKOUT.  The screen never goes dark before he is on it: the
      // frame that catches you is the first frame of him.
      // THE FLASH as he hits: a frame of white, thin enough to see him
      // through, then a red pulse, twice.
      const since = t - hitAt;
      if (since >= 0 && since < 45) {
        ctx.fillStyle = 'rgba(255,245,235,0.55)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        return;
      }
      // PANIC: the picture tearing for a moment after the hit -- a few bands
      // of it slipping sideways, dark and red.
      if (since >= 45 && since < 420 && Math.random() < 0.6) {
        for (let b = 0; b < 3; b++) {
          const y = Math.random() * GAME_H;
          const h = 2 + Math.random() * 9;
          ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(140,0,0,0.35)';
          ctx.fillRect(0, y, GAME_W, h);
        }
      }
      if (since >= 45 && since < 330) {
        const p = Math.max(0, Math.sin(((since - 45) / 285) * Math.PI * 2));
        ctx.fillStyle = `rgba(150,0,0,${(0.32 * p).toFixed(3)})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      // the frame closing in: heavy at the edges, never over the face
      const k = Math.min(1, t / SCARE_MS);
      const g = ctx.createRadialGradient(
        GAME_W / 2, GAME_H / 2, GAME_W * (0.3 - k * 0.12),
        GAME_W / 2, GAME_H / 2, GAME_W * (0.66 - k * 0.14),
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.55 + k * 0.4})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      // and red at the very end, over everything, as the picture goes
      if (k > 0.82) {
        ctx.fillStyle = `rgba(110,4,8,${(k - 0.82) * 2.6})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      if (k >= 0.97) {
        ctx.fillStyle = `rgba(0,0,0,${(k - 0.97) * 30})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
    });
  };

  const update = (dt: number): void => {
    if (done) return;
    t += dt * 1000;
    const lungeK = Phaser.Math.Clamp((t - HOLD_MS) / LUNGE_MS, 0, 1);
    const closeK = Phaser.Math.Clamp((t - HOLD_MS - LUNGE_MS) / (SCARE_MS - HOLD_MS - LUNGE_MS), 0, 1);
    // A RUSH, NOT A ZOOM: accelerating all the way in, so it is fastest at
    // the moment it arrives, then a small overshoot and settle.
    const rush = lungeK * lungeK * lungeK;
    const settle = closeK > 0 ? Math.sin(Math.min(1, closeK * 5) * Math.PI) * 0.12 : 0;
    // and once there, he keeps drifting that last little way closer
    const d = Phaser.Math.Linear(far, near, rush) - (settle + closeK * 0.14) * (near - faceFront);
    // Towering at first, his head well above yours; bending down to your
    // eye line as he comes.
    const lift = (1 - rush) * headSize * 0.35;

    // ---- HIS BODY.  Standing and breathing on the hold; reaching on the
    // lunge, the arms coming up into the frame; still reaching, half, close.
    const reaching = t < HOLD_MS ? 0 : closeK > 0 ? 0.65 : 1;
    monster.update(dt, {
      speed: 0,
      // Shut on the hold; coming open as he comes, onto the teeth; and on
      // you, working -- a little wider, a little less -- never quite still.
      // Wide -- as wide as the jaw goes -- and fast: the mouth is open before
      // he arrives, and it keeps working.
      // Already parted on the hold -- the teeth showing -- and then all the
      // way, and further than that: the jaw stretching long as he arrives.
      maw: t < HOLD_MS ? 0.35 : 1,
      mawRate: 40,
      stretch: t < HOLD_MS ? 0 : Math.min(1, lungeK * 1.4) * (0.92 + Math.abs(Math.sin(t / 110)) * 0.08),
      bare: t < HOLD_MS ? 0.6 : 1,
      climb: 0,
      lunge: reaching,
      // the arms come up as he comes in, and stay up
      grab: t < HOLD_MS + LUNGE_MS * 0.3 ? 0 : 1,
      // and the pupils shrink to pinpricks on you: a fixed predator's stare
      constrict: 1,
    });

    // ---- WHERE HIS FACE GOES: down the camera's line, at `d`, at the height.
    target.copy(basePos).addScaledVector(fwd, d);
    // his face a touch above the middle, so the eyes and the open mouth are
    // both in the frame
    target.y = basePos.y + lift + headSize * 0.1;
    // a sway across the line while he is still, and none once he is on you
    target.addScaledVector(right, t < HOLD_MS ? Math.sin(t / 260) * 0.04 * s : 0);
    monster.root.rotation.y = yaw;
    monster.root.position.set(0, 0, 0);
    monster.root.updateMatrixWorld(true);
    monster.headObject.getWorldPosition(headWorld);
    monster.root.position.copy(target).sub(headWorld);
    monster.root.updateMatrixWorld(true);

    // ---- THE FACE, straight at the lens, and never quite still.
    monster.headObject.lookAt(basePos);
    jitIn -= dt;
    if (jitIn <= 0) {
      // a snap: somewhere new, a few degrees off, and held there
      jitIn = 0.12 + Math.random() * 0.28;
      jitWant.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.22);
    }
    const snap = Math.min(1, dt * 30);
    jit.set(jit.x + (jitWant.x - jit.x) * snap, jit.y + (jitWant.y - jit.y) * snap, jit.z + (jitWant.z - jit.z) * snap);
    const still = t < HOLD_MS ? 0.25 : 1;
    // and a slow tilt underneath the snaps, like something curious
    monster.headObject.rotateX(jit.x * still + Math.sin(t / 400) * 0.03);
    monster.headObject.rotateY(jit.y * still);
    monster.headObject.rotateZ(jit.z * still + Math.sin(t / 650) * 0.1 * closeK);
    monster.lookAt(basePos);
    monster.updateEyes(dt);

    // ---- THE LIGHT follows the face in: under it and a little in front.
    const hw = headWorld.copy(target);
    // (level with the teeth rather than under the chin, so it lights the
    // face and the teeth and not the inside of the jaw)
    under.position.copy(hw).addScaledVector(fwd, -Math.min(d * 0.7, 0.9)).add(new THREE.Vector3(0, -headSize * 0.35, 0));
    // Subtle: the face only just lit, so the eyes and teeth -- which light
    // themselves -- are the brightest things on it.
    under.intensity = (0.7 + rush * 1.2) * (1 + Math.sin(t / 37) * 0.06);
    behind.position.copy(hw).addScaledVector(fwd, headSize * 1.6).add(new THREE.Vector3(0, headSize * 0.6, 0));
    behind.intensity = 2.5 + rush * 3.5;
    under.distance = 3 * s;
    behind.distance = 5 * s;
    // the carried lamps, down with the distance to his face -- and a hot lamp
    // further than a mild one, so every scene ends with the same face
    const dim = Phaser.Math.Clamp(Math.pow(Math.max(0.05, d - faceFront) / 3, 1.1), 0.02, 1);
    for (const [l, i] of carried) l.intensity = i * dim * Math.min(1, 110 / Math.max(1, i));

    // ---- THE CAMERA holds its line and takes the hit.  Still on the hold;
    // a jolt back as he arrives; a fine, fast tremor while he is there.
    cam.position.copy(basePos);
    const recoil = lungeK >= 1 ? Math.max(0, 1 - closeK * 5) * 0.12 * s : 0;
    cam.position.addScaledVector(fwd, -recoil);
    cam.quaternion.copy(baseQuat);
    // The impact: a hard kick that dies over a quarter of a second, on top of
    // a tremor that never quite stops while he is there.
    const since = t - hitAt;
    const kick = since >= 0 ? Math.max(0, 1 - since / 260) : 0;
    const tremor = t < HOLD_MS ? 0 : (0.008 + rush * 0.02) * (1 - closeK * 0.35) + kick * 0.09;
    distort(since >= 0 && since < 200 ? 1 - since / 200 : 0);
    shakeRot.set((Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor * 0.6);
    cam.quaternion.multiply(new THREE.Quaternion().setFromEuler(shakeRot));

    const f = Math.floor(t / 40);
    if (f !== flick) {
      flick = f;
      paint();
    }
    if (t > SCARE_MS + 650) dispose();
  };

  update(0);
  return { update };
}
