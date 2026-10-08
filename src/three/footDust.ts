/**
 * A puff of grit where a heavy foot comes down: a handful of square specks
 * kicked up and out from the spot, falling back and fading.  One pool per
 * scene, reused, so a long chase does not pile up meshes.
 *
 * Square, unlit points: they read as specks of dust or debris at the game's
 * pixel resolution rather than as soft particles.
 */

import * as THREE from 'three';

const MAX = 96;

export class FootDust {
  private readonly pts: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private next = 0;
  private seed = 1;

  constructor(scene: THREE.Scene, color = 0x6a5e50, size = 2) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.pts = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.pts.frustumCulled = false;
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
    scene.add(this.pts);
  }

  /** Deterministic, so the same step kicks up the same dust. */
  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** A footfall at `at` (on the floor), `hard` 0..1, `scale` the creature's size. */
  puff(at: THREE.Vector3, hard: number, scale = 1): void {
    const n = Math.round(5 + hard * 9);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const a = this.rnd() * Math.PI * 2;
      const r = (0.05 + this.rnd() * 0.12) * scale;
      this.pos[i * 3] = at.x + Math.cos(a) * r;
      this.pos[i * 3 + 1] = at.y + 0.02;
      this.pos[i * 3 + 2] = at.z + Math.sin(a) * r;
      const out = (0.4 + this.rnd() * 0.9) * (0.6 + hard) * scale;
      this.vel[i * 3] = Math.cos(a) * out;
      this.vel[i * 3 + 1] = (0.6 + this.rnd() * 1.1) * (0.5 + hard) * scale;
      this.vel[i * 3 + 2] = Math.sin(a) * out;
      this.life[i] = 0.45 + this.rnd() * 0.35;
    }
  }

  update(dt: number, floorY = 0): void {
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      alive++;
      this.vel[i * 3 + 1] -= 6 * dt;
      const drag = Math.max(0, 1 - dt * 3);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(floorY + 0.01, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.pts.visible = alive > 0;
    (this.pts.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
