/**
 * ROOM 612, IN THREE DIMENSIONS, FOR THE SECOND IT TAKES.
 *
 * He is through the window and you are still in the room.  The scare is the
 * same 3D creature and the same jumpscare as everywhere else (jumpscare3d),
 * stood in the hotel room -- the damask, the carpet, the broken window
 * behind him with the night in it -- for exactly as long as it runs.  The
 * stage is torn down after and the screen is left black.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { ThreeStage } from '../render/threeStage';
import { FroggyMonster } from '../three/froggyMonster';
import { playJumpscare3D, HOLD_MS } from './jumpscare3d';
import { audio } from '../core/audio';
import { SCARE_MS } from './jumpscare';
import { froggyLayer } from '../render/froggyLayer';
import { texCarpet, texWallpaper, texWainscot } from '../art/hotelInterior';

const SCALE = 1.3;

function tex(c: HTMLCanvasElement, rx: number, ry: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function runHotelScare(scene: Phaser.Scene, done: () => void): void {
  const root = document.getElementById('game-root');
  if (!root) {
    done();
    return;
  }
  const stage = new ThreeStage();
  stage.mount(root, scene.game.canvas);
  const s3 = stage.scene;
  s3.background = new THREE.Color(0x05060c);
  s3.fog = new THREE.FogExp2(0x05060c, 0.06);

  const paper = new THREE.MeshLambertMaterial({ map: tex(texWallpaper(), 6, 1) });
  const panel = new THREE.MeshLambertMaterial({ map: tex(texWainscot(), 8, 1) });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), new THREE.MeshLambertMaterial({ map: tex(texCarpet(), 8, 10), color: 0x9a8a80 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -3);
  s3.add(floor);
  // the far wall with the broken window in it, and the side walls
  for (const [x, z, w, ry] of [
    [-2.9, -8, 2.2, 0],
    [2.9, -8, 2.2, 0],
    [-4, -3, 10, Math.PI / 2],
    [4, -3, 10, -Math.PI / 2],
  ] as const) {
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(w, 2), paper);
    upper.position.set(x, 2, z);
    upper.rotation.y = ry;
    s3.add(upper);
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(w, 1), panel);
    lower.position.set(x, 0.5, z);
    lower.rotation.y = ry;
    s3.add(lower);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.3), new THREE.MeshLambertMaterial({ color: 0xd8ccae }));
  sill.position.set(0, 0.45, -8);
  s3.add(sill);
  const night = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.1), new THREE.MeshBasicMaterial({ color: 0x0c1430 }));
  night.position.set(0, 1.95, -8.4);
  s3.add(night);
  s3.add(new THREE.AmbientLight(0x3a4466, 0.9));
  const moon = new THREE.PointLight(0x9aaedc, 26, 14, 1.3);
  moon.position.set(0.5, 2.6, -7.4);
  s3.add(moon);

  const cam = stage.camera;
  cam.position.set(0, 1.6, 0);
  cam.rotation.set(0, 0, 0);

  // Him, in through the window, facing you across the room.
  const monster = new FroggyMonster(SCALE);
  monster.setPose(0, 0, -3.6, 0);
  s3.add(monster.root);
  monster.lookAt(cam.position);
  monster.update(0.016, { speed: 0, maw: 0.4, climb: 0, scan: 0, viewer: cam.position });

  froggyLayer.clear();
  const scare = playJumpscare3D(scene, stage, monster);
  if (!audio.screamReady()) scene.time.delayedCall(HOLD_MS, () => audio.sfx('froggy_screech', 1));
  stage.start((dt) => scare.update(dt));

  scene.time.delayedCall(SCARE_MS + 250, () => {
    stage.dispose();
    froggyLayer.clear();
    done();
  });
}
