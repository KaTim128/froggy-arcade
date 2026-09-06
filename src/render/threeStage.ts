/**
 * Three.js mount / teardown.  PRD SM-1, SM-2 / QFD A1.
 *
 * Exactly one renderer is active.  The Three canvas is layered above the Phaser
 * canvas (which draws black underneath) and below Froggy's overlay, so the
 * overlay stays aligned and the death jumpscare can paint over the 3D exactly
 * the way it paints over the 2D.
 *
 * Teardown releases the context, cancels the RAF and disposes every geometry
 * and material: ≤400ms to swap, zero leaked contexts over 20 swaps.
 */

import * as THREE from 'three';
import { GAME_W, GAME_H } from './pixelScaler';

/** Rendered low and scaled up, so the 3D matches the pixel aesthetic. */
const RENDER_W = GAME_W * 1.5;
const RENDER_H = GAME_H * 1.5;

export class ThreeStage {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private raf = 0;
  private onFrame: ((dt: number) => void) | null = null;
  private last = 0;
  private resizeRef: () => void;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(72, GAME_W / GAME_H, 0.1, 120);
    this.resizeRef = () => this.layout();
  }

  mount(root: HTMLElement, phaserCanvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RENDER_W, RENDER_H, false);

    const c = this.renderer.domElement;
    c.id = 'three-canvas';
    c.style.position = 'fixed';
    c.style.zIndex = '5';
    c.style.imageRendering = 'pixelated';
    root.appendChild(c);

    this.phaserCanvas = phaserCanvas;
    this.layout();
    window.addEventListener('resize', this.resizeRef);
  }

  private phaserCanvas: HTMLCanvasElement | null = null;

  private layout(): void {
    if (!this.renderer || !this.phaserCanvas) return;
    const r = this.phaserCanvas.getBoundingClientRect();
    const c = this.renderer.domElement;
    c.style.left = `${Math.round(r.left)}px`;
    c.style.top = `${Math.round(r.top)}px`;
    c.style.width = `${Math.round(r.width)}px`;
    c.style.height = `${Math.round(r.height)}px`;
  }

  start(onFrame: (dt: number) => void): void {
    this.onFrame = onFrame;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.onFrame?.(dt);
      this.renderer?.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** PRD SM-2: full teardown, not just a hidden canvas. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.onFrame = null;
    window.removeEventListener('resize', this.resizeRef);

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.scene.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.phaserCanvas = null;
  }
}
