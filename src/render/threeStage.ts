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
import { isTouch } from '../core/device';

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

/**
 * ONE RENDERER FOR THE WHOLE SESSION.
 *
 * Every 3D scene used to make its own WebGL context and force-lose it on the
 * way out.  A phone counts those losses: after a handful the browser blocks
 * WebGL for the page outright, and the next 3D scene got a white canvas with
 * a sad face on it instead of a context.  Now there is exactly one renderer,
 * made the first time a stage needs it and handed from stage to stage; a
 * stage that leaves only takes its canvas off the page.
 */
let shared: THREE.WebGLRenderer | null = null;

function makeRenderer(antialias: boolean): THREE.WebGLRenderer | null {
  if (shared && !shared.getContext().isContextLost()) return shared;
  shared = null;
  const tries: THREE.WebGLRendererParameters[] = [
    { antialias, powerPreference: 'low-power' },
    { antialias: false, powerPreference: 'default', precision: 'mediump' },
    { antialias: false, precision: 'lowp', stencil: false, depth: true, failIfMajorPerformanceCaveat: false },
  ];
  for (const opts of tries) {
    try {
      const r = new THREE.WebGLRenderer(opts);
      // A context the phone takes away is asked back, not left as a sad
      // face: the stage on screen covers the canvas while it is gone, and
      // offers a reload if the browser never gives it back.
      r.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        ThreeStage.current?.contextLost();
      });
      r.domElement.addEventListener('webglcontextrestored', () => ThreeStage.current?.contextRestored());
      shared = r;
      return r;
    } catch {
      // the next, plainer, attempt
    }
  }
  return null;
}

/**
 * What a phone that cannot draw 3D at all shows instead: words, on black,
 * not the browser's broken-canvas face.
 */
function noGLNotice(root: HTMLElement, lines = ['THIS DEVICE COULD NOT START THE 3D VIEW.', 'Close other tabs and apps, then reload.'], button = true): HTMLDivElement {
  const d = document.createElement('div');
  Object.assign(d.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '5',
    background: '#000',
    color: '#ffd45e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    font: '700 15px ui-monospace, monospace',
    textAlign: 'center',
    padding: '24px',
  } as Partial<CSSStyleDeclaration>);
  d.innerHTML = `<div>${lines[0]}</div>` + (lines[1] ? `<div style="color:#c9d1dc;font-weight:400">${lines[1]}</div>` : '');
  if (!button) {
    root.appendChild(d);
    return d;
  }
  const b = document.createElement('button');
  b.textContent = 'RELOAD';
  Object.assign(b.style, { font: 'inherit', padding: '10px 22px', background: '#3d2a5c', color: '#fff0c9', border: '2px solid #ffd45e', borderRadius: '10px' });
  b.addEventListener('click', () => window.location.reload());
  d.appendChild(b);
  root.appendChild(d);
  return d;
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
    // (no multisampling on a phone: it is the first thing that runs one out
    // of memory, and the probe for a software renderer costs a context)
    this.renderer = makeRenderer(!isTouch() && this.smooth && !softwareGL());
    if (!this.renderer) {
      this.notice = noGLNotice(root);
      ThreeStage.current = this;
      return;
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setScissorTest(false);
    this.renderer.setSize(RENDER_W, RENDER_H, false);
    // (resized again by the quality level, in applyQuality)

    const c = this.renderer.domElement;
    // (the canvas is shared: whatever the last scene left on it goes)
    c.style.cssText = '';
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
  private notice: HTMLDivElement | null = null;
  /** Shaders still compiling: nothing steps or draws until they are done. */
  private warming = false;
  /** The context is gone, and the world holds still until it is back. */
  private lost = false;
  private lostCover: HTMLDivElement | null = null;
  private lostTimer = 0;

  /**
   * The browser took the context away (out of GPU memory, the GPU reset).
   * The canvas is covered in black with a word on it, the world holds still,
   * and if the context is not back in a few seconds the cover offers a
   * reload -- the run is saved, so it comes back at its checkpoint.
   */
  contextLost(): void {
    if (this.lost) return;
    this.lost = true;
    const root = this.renderer?.domElement.parentElement ?? document.getElementById('game-root');
    if (!root) return;
    this.lostCover?.remove();
    this.lostCover = noGLNotice(root, ['RESTORING THE 3D VIEW...'], false);
    this.lostCover.style.zIndex = '60';
    this.lostTimer = window.setTimeout(() => {
      if (!this.lost) return;
      this.lostCover?.remove();
      this.lostCover = noGLNotice(root, ['THE 3D VIEW STOPPED.', 'Your progress is saved. Close other tabs and apps, then reload.']);
      this.lostCover.style.zIndex = '60';
    }, 5000);
  }

  /** The context is back: three.js rebuilds what it had; uncover and go on. */
  contextRestored(): void {
    if (!this.lost) return;
    this.lost = false;
    window.clearTimeout(this.lostTimer);
    this.lostCover?.remove();
    this.lostCover = null;
    this.last = performance.now();
  }
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
        // (a glow or a beam of light marked `noShadow` must never throw one:
        // a torch's own beam would put the torch in its shadow)
        const lit = !(mesh.userData as { noShadow?: boolean }).noShadow;
        mesh.castShadow = shadows && lit;
        mesh.receiveShadow = shadows && lit;
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
    // ---- EVERY SHADER BUILT BEFORE THE FIRST FRAME, NOT ON IT.  A big
    // scene's first frame used to compile fifty-odd programs in one go,
    // and a phone that spends that long on one frame resets the GPU and
    // takes the page's context with it: the white canvas and the sad face.
    // Compiled in the background (where the browser can), the world holds
    // still until it is ready, and the first frame is an ordinary one.
    const r = this.renderer;
    this.warming = !!r;
    const ready = (): void => {
      if (!this.warming) return;
      this.warming = false;
      this.last = performance.now();
    };
    if (r) {
      try {
        // (one step at no time first: the world as the first frame will
        // draw it, so what is compiled is what is used)
        this.onFrame(0);
        void r.compileAsync(this.scene, this.camera).then(ready, ready);
      } catch {
        ready();
      }
      window.setTimeout(ready, 8000);
    }
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      // (the first frame's timestamp can be from before `start` was called,
      // which made the first step negative)
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      // Paused, the world holds still: nothing steps, and on the way back the
      // clock picks up from now rather than handing over the whole pause as
      // one enormous frame.
      if (this.paused || this.warming || this.lost) return;
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
   * For a jumpscare: render the picture sharper for as long as his face is
   * against the lens -- pores and teeth instead of soft squares -- then put
   * the quality level back.  (A phone gets less of a boost than a desktop.)
   */
  boost(on: boolean): void {
    const r = this.renderer;
    if (!r) return;
    if (!on) {
      this.applyQuality();
      return;
    }
    const k = Math.max(qualityProfile().res, isTouch() ? 2 : 3);
    r.setSize(Math.round(GAME_W * k), Math.round(GAME_H * k), false);
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
      // the textures too: they are most of the memory a phone runs out of
      const drop = (m: THREE.Material) => {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      };
      if (Array.isArray(mat)) mat.forEach(drop);
      else if (mat) drop(mat);
    });
    this.scene.clear();

    this.notice?.remove();
    this.notice = null;
    window.clearTimeout(this.lostTimer);
    this.lostCover?.remove();
    this.lostCover = null;
    this.lost = false;
    this.warming = false;
    if (this.renderer) {
      // The context stays: it is the session's, and the next stage takes it
      // (see `shared`).  Only what this scene put in it goes.
      this.renderer.renderLists.dispose();
      this.renderer.info.reset();
      this.renderer.domElement.style.visibility = '';
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.phaserCanvas = null;
  }
}
