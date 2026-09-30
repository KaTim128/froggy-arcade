/**
 * ONE DRAW CALL PER MATERIAL, NOT ONE PER BOARD.
 *
 * The props in the hide rooms are built the way they look -- a machine is a
 * dozen boxes, a shelf of stock is forty, a ball pit is two hundred balls --
 * and handed to the renderer like that, a room of them is thousands of draw
 * calls, which a phone (and a software renderer) cannot afford.  Nothing in a
 * prop moves once it is built, so its pieces are merged: every mesh under the
 * group that shares a look becomes one mesh.  The group keeps its transform,
 * and anything that is not a plain mesh (a light, an object something else
 * holds on to) is left where it was.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function matKey(m: THREE.Material): string {
  const a = m as THREE.MeshLambertMaterial & THREE.MeshBasicMaterial;
  return [
    m.type,
    a.color?.getHexString() ?? '',
    a.map?.uuid ?? '',
    a.emissive?.getHexString?.() ?? '',
    m.transparent ? a.opacity : 1,
    m.side,
    m.depthWrite,
  ].join('|');
}

/**
 * Merge the static meshes under `root` by material.  `keep` is anything that
 * must stay its own object -- and everything under it.
 */
export function bake(root: THREE.Object3D, keep: THREE.Object3D[] = []): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const kept = new Set<THREE.Object3D>();
  for (const k of keep) k.traverse((o) => kept.add(o));
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const done: THREE.Mesh[] = [];
  const rel = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || kept.has(mesh) || Array.isArray(mesh.material)) return;
    if (mesh.name) return; // named parts are looked up by name elsewhere
    const mat = mesh.material as THREE.Material;
    let geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    rel.multiplyMatrices(inv, mesh.matrixWorld);
    geo.applyMatrix4(rel);
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    }
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const key = matKey(mat);
    let b = buckets.get(key);
    if (!b) {
      b = { mat, geos: [] };
      buckets.set(key, b);
    }
    b.geos.push(geo);
    done.push(mesh);
  });
  // Nothing worth doing: leave it alone.
  if (done.length < 2) return;
  for (const m of done) m.parent?.remove(m);
  for (const { mat, geos } of buckets.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    // it is in root's space now
    root.add(mesh);
  }
  // groups left empty by the move are dropped
  const empties: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !kept.has(o) && o.type === 'Group' && o.children.length === 0) empties.push(o);
  });
  for (const e of empties) e.parent?.remove(e);
}
