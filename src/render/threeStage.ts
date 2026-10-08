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
import { applyDisplay, onGraphicsChange, qualityProfile, shadowsOn } from '../core/graphics';

/** Rendered low and scaled up, so the 3D matches the pixel aesthetic. */
const RENDER_W = GAME_W * 1.5;
const RENDER_H = GAME_H * 1.5;

/**
 * Whether WebGL here is drawn by the CPU (SwiftShader, llvmpipe and the
 * like).  Multisampling there costs four times the fill on a processor that
 * is already doing all of it, and the frame rate drops through the floor --
 * so a smoothed stage is smoothed only where there is a GPU to do it.
 */
let software: boolean | null = null;
function softwareGL(): boolean {
  if (software !== null) return software;
  software = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    software = /swiftshader|llvmpipe|software|softpipe/i.test(name);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    software = false;
  }
  return software;
}

export class ThreeStage {
  /**
   * The stage on screen, if any.  There is only ever one (see above), and the
   * pause menu needs to reach it without knowing which scene owns it.
   */
  static current: ThreeStage | null = null;
  /** Frozen: no frames are stepped and the canvas is out of the way. */
  private paused = false;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private raf = 0;
  private onFrame: ((dt: number) => void) | null = null;
  private last = 0;
  private resizeRef: () => void;

  /** Multisampled, so thin geometry has clean edges instead of stair-steps. */
  private readonly smooth: boolean;

  constructor(opts: { smooth?: boolean } = {}) {
    this.camera = new THREE.PerspectiveCamera(72, GAME_W / GAME_H, 0.1, 120);
    this.resizeRef = () => this.layout();
    this.smooth = !!opts.smooth;
  }

  mount(root: HTMLElement, phaserCanvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: this.smooth && !softwareGL(), powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RENDER_W, RENDER_H, false);
    // (resized again by the quality level, in applyQuality)

    const c = this.renderer.domElement;
    c.id = 'three-canvas';
    c.style.position = 'fixed';
    c.style.zIndex = '5';
    c.style.imageRendering = 'pixelated';
    root.appendChild(c);
    // CINEMATIC's lens: a vignette over the 3D, never in the way of a click
    const v = document.createElement('div');
    v.style.position = 'fixed';
    v.style.zIndex = '6';
    v.style.pointerEvents = 'none';
    v.style.boxShadow = 'inset 0 0 18vmin 4vmin rgba(0,0,0,0.75)';
    v.style.display = 'none';
    root.appendChild(v);
    this.vignette = v;
    this.offGraphics = onGraphicsChange(() => this.applyQuality());
    applyDisplay();

    this.phaserCanvas = phaserCanvas;
    ThreeStage.current = this;
    this.layout();
    window.addEventListener('resize', this.resizeRef);
  }

  private phaserCanvas: HTMLCanvasElement | null = null;
  private vignette: HTMLDivElement | null = null;
  private offGraphics: (() => void) | null = null;
  /** What the scene was built with, before any quality level touched it. */
  private base: { far: number; fog: number | null; fogFar: number | null } | null = null;
  private shadowLights: THREE.DirectionalLight[] = [];

  /**
   * THE QUALITY LEVEL, APPLIED.  Called as the scene starts and again
   * whenever the setting moves -- see core/graphics for what each level is.
   * Everything here is reversible: the values the scene was built with are
   * kept, and each level is applied to those, never to the last level's.
   */
  applyQuality(): void {
    const r = this.renderer;
    if (!r) return;
    const q = qualityProfile();
    if (!this.base) {
      const fog = this.scene.fog;
      this.base = {
        far: this.camera.far,
        fog: fog instanceof THREE.FogExp2 ? fog.density : null,
        fogFar: fog instanceof THREE.Fog ? fog.far : null,
      };
    }
    r.setSize(Math.round(GAME_W * q.res), Math.round(GAME_H * q.res), false);
    this.camera.far = this.base.far * q.far;
    this.camera.updateProjectionMatrix();
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2 && this.base.fog !== null) fog.density = this.base.fog * q.fog;
    if (fog instanceof THREE.Fog && this.base.fogFar !== null) fog.far = this.base.fogFar / q.fog;

    // shadows: spot and directional lights only (a point light's shadow is six
    // renders of the room, every frame)
    const shadows = shadowsOn() && q.shadowMap > 0;
    const was = r.shadowMap.enabled;
    r.shadowMap.enabled = shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.shadowLights = [];
    const maxAniso = r.capabilities.getMaxAnisotropy();
    const seen = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const light = o as THREE.SpotLight | THREE.DirectionalLight;
      if ((light as THREE.SpotLight).isSpotLight || (light as THREE.DirectionalLight).isDirectionalLight) {
        light.castShadow = shadows;
        if (shadows) {
          light.shadow.mapSize.set(q.shadowMap, q.shadowMap);
          light.shadow.map?.dispose();
          light.shadow.map = null;
          light.shadow.bias = -0.0006;
          if ((light as THREE.DirectionalLight).isDirectionalLight) {
            const cam = light.shadow.camera as THREE.OrthographicCamera;
            const span = 18 + q.res * 6;
            cam.left = -span;
            cam.right = span;
            cam.top = span;
            cam.bottom = -span;
            cam.near = 1;
            cam.far = 160;
            cam.updateProjectionMatrix();
            this.shadowLights.push(light as THREE.DirectionalLight);
          }
        }
      }
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const map = (m as THREE.MeshStandardMaterial).map;
          if (map && !seen.has(map)) {
            seen.add(map);
            const a = Math.min(maxAniso, q.aniso);
            if (map.anisotropy !== a) {
              map.anisotropy = a;
              map.needsUpdate = true;
            }
          }
          if (was !== shadows) m.needsUpdate = true;
        }
      }
      // decorative greenery and particles, thinned (never what you hide in)
      const ud = o.userData as { foliage?: number; particles?: number };
      if (ud.foliage !== undefined) (o as THREE.InstancedMesh).count = Math.max(1, Math.floor(ud.foliage * q.foliage));
      if (ud.particles !== undefined) (o as THREE.Points).geometry.setDrawRange(0, Math.max(1, Math.floor(ud.particles * q.particles)));
    });
    if (this.vignette) this.vignette.style.display = q.post ? 'block' : 'none';
    applyDisplay();
  }

  private layout(): void {
    if (!this.renderer || !this.phaserCanvas) return;
    const r = this.phaserCanvas.getBoundingClientRect();
    const c = this.renderer.domElement;
    c.style.left = `${Math.round(r.left)}px`;
    c.style.top = `${Math.round(r.top)}px`;
    c.style.width = `${Math.round(r.width)}px`;
    c.style.height = `${Math.round(r.height)}px`;
    if (this.vignette) {
      this.vignette.style.left = c.style.left;
      this.vignette.style.top = c.style.top;
      this.vignette.style.width = c.style.width;
      this.vignette.style.height = c.style.height;
    }
  }

  start(onFrame: (dt: number) => void): void {
    this.applyQuality();
    this.onFrame = onFrame;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      // (the first frame's timestamp can be from before `start` was called,
      // which made the first step negative)
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      // Paused, the world holds still: nothing steps, and on the way back the
      // clock picks up from now rather than handing over the whole pause as
      // one enormous frame.
      if (this.paused) return;
      this.onFrame?.(dt);
      // a directional light's shadow box goes where you are
      for (const l of this.shadowLights) {
        const dir = l.position.clone().sub(l.target.position).normalize();
        l.target.position.copy(this.camera.position);
        l.target.updateMatrixWorld();
        l.position.copy(this.camera.position).addScaledVector(dir, 60);
      }
      this.renderer?.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /**
   * Build every shader the scene will need now, while nothing is happening,
   * instead of on the first frame a material is seen -- which, for a scare,
   * is the one frame that must not stall.
   */
  compile(): void {
    this.renderer?.compile(this.scene, this.camera);
  }

  /**
   * Freeze the world under the pause menu.  The canvas is hidden as well as
   * stopped: it sits over the Phaser canvas the menu is drawn on, so a frozen
   * room left showing would be drawn straight over the menu.
   */
  setPaused(p: boolean): void {
    this.paused = p;
    if (this.renderer) this.renderer.domElement.style.visibility = p ? 'hidden' : '';
  }

  /**
   * Get `obj` ready to draw, now, while nothing is watching.  Something kept
   * hidden for a reveal otherwise pays on the frame it is first seen for
   * everything a first draw costs -- its shaders, its textures, every one of
   * its meshes' buffers going up to the GPU -- and for a whole creature that
   * was a stall of the best part of a second at the worst moment there is.
   * So it is drawn once here, for real, against the scene's lights as they
   * stand (call it once they are in): shown, never culled, and squeezed into
   * a single pixel in the corner that the next frame paints over.
   */
  warm(obj: THREE.Object3D): void {
    const r = this.renderer;
    if (!r) return;
    const shown: THREE.Object3D[] = [];
    const culled: THREE.Object3D[] = [];
    obj.traverse((o) => {
      if (!o.visible) {
        o.visible = true;
        shown.push(o);
      }
      if (o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    const vp = r.getViewport(new THREE.Vector4());
    r.setScissorTest(true);
    r.setScissor(0, 0, 1, 1);
    r.setViewport(0, 0, 1, 1);
    r.render(this.scene, this.camera);
    r.setScissorTest(false);
    r.setViewport(vp);
    for (const o of culled) o.frustumCulled = true;
    for (const o of shown) o.visible = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** PRD SM-2: full teardown, not just a hidden canvas. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (ThreeStage.current === this) ThreeStage.current = null;
    this.paused = false;
    this.onFrame = null;
    window.removeEventListener('resize', this.resizeRef);
    this.offGraphics?.();
    this.offGraphics = null;
    this.vignette?.remove();
    this.vignette = null;
    this.base = null;
    this.shadowLights = [];

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
