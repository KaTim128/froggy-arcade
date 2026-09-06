/**
 * The ending.  PRD §7.16 / §12 of the brief.
 *
 * Third person, camera pulled back and LOCKED.  The player bursts out the front
 * door and sprints away down the street, and the camera does not follow them —
 * it holds on the arcade entrance.
 *
 * Froggy steps into the doorway.  He does not chase.  He watches, until the
 * player is out of frame, and then for three more seconds.
 *
 * He does not speak.  He has not spoken since "You can go now."
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const RUN_SPEED = 6.5;
const OUT_OF_FRAME_X = -26;
const HOLD_AFTER_MS = 3000;

export class OutroCutscene3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private runner: THREE.Mesh | null = null;
  private froggySprite: THREE.Sprite | null = null;
  private t = 0;
  private outOfFrameAt: number | null = null;
  private done = false;

  constructor() {
    super('OutroCutscene3D');
  }

  create(): void {
    froggyLayer.clear();
    this.t = 0;
    this.outOfFrameAt = null;
    this.done = false;

    audio.setScene({ ambience: ['wind_low', 'crickets'] });

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    this.cameras.main.fadeIn(700, 0, 0, 0);

    const root = document.getElementById('game-root');
    if (!root) return;

    this.stage = new ThreeStage();
    this.stage.mount(root, this.game.canvas);
    this.build();
    this.stage.start((dt) => this.tick(dt));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  private build(): void {
    const st = this.stage!;
    st.scene.background = new THREE.Color(0x0d1424);
    st.scene.fog = new THREE.FogExp2(0x0d1424, 0.022);

    st.scene.add(new THREE.AmbientLight(0x3b4a66, 0.7));
    const street = new THREE.PointLight(0xffd9a0, 90, 34, 1.3);
    street.position.set(-9, 6.5, 5);
    st.scene.add(street);

    // pavement
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 40),
      new THREE.MeshLambertMaterial({ color: 0x39424f }),
    );
    ground.rotation.x = -Math.PI / 2;
    st.scene.add(ground);

    // the arcade front, dark
    const facade = new THREE.Mesh(
      new THREE.BoxGeometry(26, 11, 6),
      new THREE.MeshLambertMaterial({ color: 0x2b3444 }),
    );
    facade.position.set(2, 5.5, -7);
    st.scene.add(facade);

    // windows, black
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 3.4),
        new THREE.MeshBasicMaterial({ color: 0x060910 }),
      );
      w.position.set(-6 + i * 8.5, 6.4, -3.94);
      st.scene.add(w);
    }

    // the doorway: a dark recess he can stand in
    const doorway = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 5.4),
      new THREE.MeshBasicMaterial({ color: 0x04060b }),
    );
    doorway.position.set(2, 2.7, -3.93);
    st.scene.add(doorway);

    // dead neon sign
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.2, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2a2036 }),
    );
    sign.position.set(2, 9.6, -3.7);
    st.scene.add(sign);

    // streetlight pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 9),
      new THREE.MeshLambertMaterial({ color: 0x4a5461 }),
    );
    pole.position.set(-9, 4.5, 4);
    st.scene.add(pole);

    // the player, already running
    this.runner = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x9c7248 }),
    );
    this.runner.position.set(2, 1, 1);
    st.scene.add(this.runner);

    // Froggy, in the doorway, not yet
    const tex = new THREE.CanvasTexture(this.froggyTexture());
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: true }));
    sprite.scale.set(6.2, 6.2, 1);
    sprite.position.set(2, 3.1, -3.6);
    sprite.material.opacity = 0;
    st.scene.add(sprite);
    this.froggySprite = sprite;

    // The camera never moves.  PRD §7.16.
    st.camera.position.set(-4, 4.2, 15);
    st.camera.lookAt(2, 3.2, -4);
  }

  private froggyTexture(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 384;
    const ctx = c.getContext('2d')!;
    // Mouth closed.  He is not attacking.  He is watching.
    drawFroggy(ctx, { x: 192, y: 356, height: 320, variant: 'predator', maw: 0.05 });
    return c;
  }

  private tick(dt: number): void {
    if (this.done || !this.runner) return;
    this.t += dt;

    // the player sprints off down the street; the camera stays where it is
    this.runner.position.x -= RUN_SPEED * dt;
    this.runner.position.y = 1 + Math.abs(Math.sin(this.t * 9)) * 0.16;

    // 1.5s in, he steps into the doorway
    if (this.t > 1.5 && this.froggySprite) {
      this.froggySprite.material.opacity = Math.min(1, (this.t - 1.5) / 0.5);
    }

    if (this.outOfFrameAt === null && this.runner.position.x < OUT_OF_FRAME_X) {
      this.outOfFrameAt = this.t;
    }

    // ...and then he watches for three more seconds
    if (this.outOfFrameAt !== null && this.t - this.outOfFrameAt > HOLD_AFTER_MS / 1000) {
      this.finish();
    }
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    this.time.delayedCall(1400, () => {
      this.teardown();
      store.patch({ route: 'ended' });
      store.flush();
      this.scene.start('EndCard', { title: 'End' });
    });
  }

  private teardown(): void {
    this.stage?.dispose();
    this.stage = null;
    this.runner = null;
    this.froggySprite = null;
  }
}
