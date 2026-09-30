/**
 * THE KEY ROOM, IN THREE DIMENSIONS, FOR THE SECOND IT TAKES.
 *
 * The basement is a sequence of drawn frames, and he has just been standing
 * at the far end of the last one with his pupils blown wide.  The scare is not
 * a drawing: it is the same 3D creature that will hunt you through the rooms
 * upstairs, stood in a bare concrete room lit by one bulb, and driven at the
 * camera by the same jumpscare the rooms use (jumpscare3d) -- the rush, the
 * face filling the frame, the scream on the frame he moves.
 *
 * It owns a stage of its own for exactly as long as it runs, and leaves
 * nothing behind: when it is over the stage is torn down and the screen is
 * black, which is where the basement wants it.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { ThreeStage } from '../render/threeStage';
import { FroggyMonster } from '../three/froggyMonster';
import { playJumpscare3D, HOLD_MS } from './jumpscare3d';
import { audio } from '../core/audio';
import { SCARE_MS } from './jumpscare';
import { froggyLayer } from '../render/froggyLayer';

/** The rooms' own size for him, so it is the same creature at the same height. */
const SCALE = 1.75;

export function runKeyRoomScare(scene: Phaser.Scene, done: () => void): void {
  const root = document.getElementById('game-root');
  if (!root) {
    done();
    return;
  }
  const stage = new ThreeStage();
  stage.mount(root, scene.game.canvas);
  const s3 = stage.scene;
  s3.background = new THREE.Color(0x030304);
  s3.fog = new THREE.FogExp2(0x030304, 0.09);

  // The key room: bare concrete, one bulb, and the door you came in by
  // behind him.
  const concrete = new THREE.MeshLambertMaterial({ color: 0x3a3632 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshLambertMaterial({ color: 0x2a2724 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -4);
  s3.add(floor);
  for (const [x, z, w, d] of [
    [0, -9, 10, 0.3],
    [-5, -4, 0.3, 12],
    [5, -4, 0.3, 12],
  ] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), concrete);
    wall.position.set(x, 2, z);
    s3.add(wall);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.1), new THREE.MeshLambertMaterial({ color: 0x241712 }));
  door.position.set(0, 1.2, -8.8);
  s3.add(door);
  s3.add(new THREE.AmbientLight(0x2a2626, 0.7));
  const bulb = new THREE.PointLight(0xffd8a0, 16, 12, 1.4);
  bulb.position.set(0.3, 3.4, -2.2);
  s3.add(bulb);

  // You, having just turned round with the key in your hand.
  const cam = stage.camera;
  cam.position.set(0, 1.6, 0);
  cam.rotation.set(0, 0, 0);

  // Him, where the drawing had him: across the room, facing you.
  const monster = new FroggyMonster(SCALE);
  monster.setPose(0, 0, -3.4, 0);
  s3.add(monster.root);
  monster.lookAt(cam.position);
  monster.update(0.016, { speed: 0, maw: 0.15, climb: 0, scan: 0, viewer: cam.position });

  froggyLayer.clear();
  const scare = playJumpscare3D(scene, stage, monster);
  // His own scream, on the frame he leaves the spot he was stood on -- not
  // before, so the sound and the rush arrive together.
  scene.time.delayedCall(HOLD_MS, () => audio.sfx('froggy_screech', 1));
  stage.start((dt) => scare.update(dt));

  // The scare's own length, and a beat on the end of it for the red to land;
  // then the stage goes and the frame is black.
  scene.time.delayedCall(SCARE_MS + 250, () => {
    stage.dispose();
    froggyLayer.clear();
    done();
  });
}
