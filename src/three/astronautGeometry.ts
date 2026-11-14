// Splits the NASA astronaut model into body regions so each region can glow in its own alert colour.
// Model space (as published): z is up, the visor faces -y, the astronaut's left hand is at +x, arms out (T-pose).

import * as THREE from 'three';
import type { BodyRegion } from '../domain/body';

export const REGIONS: BodyRegion[] = [
  'head',
  'chest',
  'leftShoulder',
  'rightShoulder',
  'leftArm',
  'rightArm',
  'leftHand',
  'rightHand',
  'leftLeg',
  'rightLeg',
];

/** Region of a point in model space. Boundaries were measured from the model's vertex distribution. */
export function regionAt(x: number, y: number, z: number): BodyRegion {
  const ax = Math.abs(x);
  const left = x > 0;
  const backpack = y > 7;
  if (z < -6 && !backpack) return left ? 'leftLeg' : 'rightLeg';
  if (ax > 26) return left ? 'leftHand' : 'rightHand';
  if (ax > 15) return left ? 'leftArm' : 'rightArm';
  if (backpack) return 'chest';
  if (z > 25) return 'head';
  if (ax > 8.5 && z > 14) return left ? 'leftShoulder' : 'rightShoulder';
  return 'chest';
}

/**
 * Reorders the triangles of a mesh by region and adds one draw group per region (material index = REGIONS index).
 * Returns a geometry rotated to y-up, centred and scaled to `height` world units.
 */
export function regionGeometry(src: THREE.BufferGeometry, height: number, bounds: THREE.Box3): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src;
  const pos = g.getAttribute('position');
  const tris = pos.count / 3;
  const buckets: number[][] = REGIONS.map(() => []);
  for (let t = 0; t < tris; t++) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let v = 0; v < 3; v++) {
      cx += pos.getX(3 * t + v);
      cy += pos.getY(3 * t + v);
      cz += pos.getZ(3 * t + v);
    }
    buckets[REGIONS.indexOf(regionAt(cx / 3, cy / 3, cz / 3))].push(t);
  }

  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name);
    const size = a.itemSize;
    const arr = new Float32Array(a.count * size);
    let o = 0;
    for (const bucket of buckets) {
      for (const t of bucket) {
        for (let v = 0; v < 3; v++) {
          for (let k = 0; k < size; k++) arr[o++] = a.getComponent(3 * t + v, k);
        }
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  let start = 0;
  buckets.forEach((bucket, i) => {
    out.addGroup(start, bucket.length * 3, i);
    start += bucket.length * 3;
  });
  return orient(out, height, bounds);
}

/** Rotates model space (z up, facing -y) to world space (y up, facing +z), centres and scales. */
export function orient(g: THREE.BufferGeometry, height: number, bounds: THREE.Box3): THREE.BufferGeometry {
  const centre = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const s = height / size.z;
  g.translate(-centre.x, -centre.y, -centre.z);
  g.rotateX(-Math.PI / 2);
  g.scale(s, s, s);
  g.computeBoundingSphere();
  return g;
}
