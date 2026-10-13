/**
 * NOTHING BETWEEN YOU AND HIS FACE.
 *
 * The 3D jumpscare puts Froggy down the line the camera was looking along.
 * Caught facing a wall, a cupboard or a lamp, that line ran into the room:
 * his face came out of the plaster, or a shelf sat across his teeth.  This is
 * the check that runs first, and the culling that runs during:
 *
 *  - `validateJumpscareConditions` casts rays from the camera to where his
 *    head, eyes, mouth and shoulders will be and reports what is in the way;
 *  - `clearScareLine` turns the scare to the nearest direction that has room
 *    for him when the one you were facing does not;
 *  - `ScareCuller` hides small props that come between the lens and his face
 *    for the length of the scare, and puts them back after.
 */

import * as THREE from 'three';

/** A blocker this big (bounding radius, metres) is a wall: turned away from, not hidden. */
const STRUCTURE_R = 1.2;

function ignored(o: THREE.Object3D, skip: THREE.Object3D[]): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (skip.includes(p)) return true;
  return false;
}

/** Every visible solid mesh in the scene the rays should test, minus `skip` and their children. */
export function solidMeshes(scene: THREE.Scene, skip: THREE.Object3D[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scene.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || ignored(m, skip)) return;
    const mat = m.material as THREE.Material | THREE.Material[];
    const mats = Array.isArray(mat) ? mat : [mat];
    // glass, fog cards and glows are not in the way
    if (mats.every((x) => !x.visible || (x.transparent && x.opacity < 0.35))) return;
    out.push(m);
  });
  return out;
}

const ray = new THREE.Raycaster();

/** What a straight line from `from` to `to` hits first, short of `to`. */
export function firstHit(meshes: THREE.Mesh[], from: THREE.Vector3, to: THREE.Vector3): THREE.Intersection | null {
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len < 1e-4) return null;
  ray.set(from, dir.divideScalar(len));
  ray.near = 0.02;
  ray.far = len - 0.05;
  const hits = ray.intersectObjects(meshes, false);
  return hits[0] ?? null;
}

/** How far you can see down `dir` from `from` before something solid. */
export function clearDistance(meshes: THREE.Mesh[], from: THREE.Vector3, dir: THREE.Vector3, max: number): number {
  ray.set(from, dir.clone().normalize());
  ray.near = 0.02;
  ray.far = max;
  const hit = ray.intersectObjects(meshes, false)[0];
  return hit ? hit.distance : max;
}

export interface ScareCheck {
  clear: boolean;
  /** What is in the way, nearest first. */
  blockers: THREE.Object3D[];
  /** Whether any blocker is structure (a wall) rather than a prop. */
  structural: boolean;
}

function radiusOf(o: THREE.Object3D): number {
  const m = o as THREE.Mesh;
  if (!m.geometry) return 0;
  if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
  const s = new THREE.Vector3();
  m.getWorldScale(s);
  return (m.geometry.boundingSphere?.radius ?? 0) * Math.max(s.x, s.y, s.z);
}

/**
 * THE PRE-SCARE CHECK.  From the camera to the points that have to be seen
 * -- the middle of his head, both eyes, his mouth, both shoulders -- for a
 * face at `face`, `size` across.
 */
export function validateJumpscareConditions(
  meshes: THREE.Mesh[],
  cam: THREE.Vector3,
  face: THREE.Vector3,
  right: THREE.Vector3,
  size: number,
): ScareCheck {
  const up = new THREE.Vector3(0, 1, 0);
  const pts = [
    face.clone(),
    face.clone().addScaledVector(right, -size * 0.22).addScaledVector(up, size * 0.12),
    face.clone().addScaledVector(right, size * 0.22).addScaledVector(up, size * 0.12),
    face.clone().addScaledVector(up, -size * 0.3),
    face.clone().addScaledVector(right, -size * 0.9).addScaledVector(up, -size * 1.1),
    face.clone().addScaledVector(right, size * 0.9).addScaledVector(up, -size * 1.1),
  ];
  const blockers: THREE.Object3D[] = [];
  for (const p of pts) {
    const h = firstHit(meshes, cam, p);
    if (h && !blockers.includes(h.object)) blockers.push(h.object);
  }
  return { clear: blockers.length === 0, blockers, structural: blockers.some((b) => radiusOf(b) >= STRUCTURE_R) };
}

/**
 * THE FALLBACK PLACE.  Facing a wall, there is no room down the line you are
 * looking along for something to come at you.  The nearest turn -- right or
 * left, a little then more, and behind you last -- that has `need` metres of
 * clear floor in front of it is the line the scare comes down instead.
 * Returns the flat direction to use (the given one when it is already clear).
 */
export function clearScareLine(meshes: THREE.Mesh[], cam: THREE.Vector3, fwd: THREE.Vector3, need: number): THREE.Vector3 {
  // tested a little below the eye, where his head and shoulders will be
  const eye = cam.clone();
  if (clearDistance(meshes, eye, fwd, need) >= need) return fwd.clone();
  let best = fwd.clone();
  let bestRoom = clearDistance(meshes, eye, fwd, need);
  for (const deg of [25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180]) {
    const d = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg));
    const room = clearDistance(meshes, eye, d, need);
    if (room >= need) return d;
    if (room > bestRoom) {
      bestRoom = room;
      best = d;
    }
  }
  return best;
}

/**
 * DURING THE SCARE: anything that drifts between the lens and his face is
 * taken out of the picture -- props outright; walls too, as a last resort,
 * because a scare you cannot see is no scare -- and every one of them is put
 * back as it was when the scare ends.
 */
export class ScareCuller {
  private hidden: THREE.Object3D[] = [];
  constructor(private meshes: THREE.Mesh[]) {}

  /**
   * Clear the line from `cam` to each of `targets`.  `propsOnly` leaves walls
   * where they are (for the hands, which reach to the edges of the frame).
   */
  clear(cam: THREE.Vector3, targets: THREE.Vector3[], propsOnly = false): void {
    for (const t of targets) {
      for (let i = 0; i < 4; i++) {
        const h = firstHit(this.meshes, cam, t);
        if (!h) break;
        const o = h.object;
        if (propsOnly && radiusOf(o) >= STRUCTURE_R) break;
        o.visible = false;
        this.hidden.push(o);
        this.meshes = this.meshes.filter((m) => m !== o);
      }
    }
  }

  restore(): void {
    for (const o of this.hidden) o.visible = true;
    this.hidden = [];
  }

  get count(): number {
    return this.hidden.length;
  }
}
