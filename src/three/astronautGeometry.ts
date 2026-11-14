// Splits the NASA astronaut model into body regions (each glows in its own alert colour) and into moving parts
// (arms and legs turn at the shoulders and hips; the model has no skeleton).
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

export type PartId = 'core' | 'armL' | 'armR' | 'legL' | 'legR';
export const PART_IDS: PartId[] = ['core', 'armL', 'armR', 'legL', 'legR'];

const PART_OF: Record<BodyRegion, PartId> = {
  head: 'core',
  chest: 'core',
  leftShoulder: 'core',
  rightShoulder: 'core',
  leftArm: 'armL',
  leftHand: 'armL',
  rightArm: 'armR',
  rightHand: 'armR',
  leftLeg: 'legL',
  rightLeg: 'legR',
};

/** Joints in model space: shoulders for the arms, hips for the legs. */
const PIVOTS: Record<PartId, [number, number, number]> = {
  core: [0, 0, 0],
  armL: [13, 0, 17.5],
  armR: [-13, 0, 17.5],
  legL: [5.5, 0, -6],
  legR: [-5.5, 0, -6],
};

export interface Part {
  /** Geometry with one draw group per region (material index = REGIONS index), centred on the joint. */
  geometry: THREE.BufferGeometry;
  /** Joint position in the astronaut's local space. */
  pivot: THREE.Vector3;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Model space → astronaut local space: y up, facing +z, centred, `height` tall. */
function transformFor(height: number, bounds: THREE.Box3) {
  const centre = bounds.getCenter(new THREE.Vector3());
  const s = height / bounds.getSize(new THREE.Vector3()).z;
  return {
    geometry(g: THREE.BufferGeometry) {
      g.translate(-centre.x, -centre.y, -centre.z);
      g.rotateX(-Math.PI / 2);
      g.scale(s, s, s);
      return g;
    },
    point([x, y, z]: [number, number, number]) {
      return new THREE.Vector3(x - centre.x, y - centre.y, z - centre.z).applyAxisAngle(X_AXIS, -Math.PI / 2).multiplyScalar(s);
    },
  };
}

export function orient(g: THREE.BufferGeometry, height: number, bounds: THREE.Box3): THREE.BufferGeometry {
  return transformFor(height, bounds).geometry(g);
}

export interface RegionCentre {
  part: PartId;
  /** Centre of the region in its part's local space (so a marker follows a moving arm or leg). */
  position: THREE.Vector3;
}

export interface AstronautParts {
  parts: Record<PartId, Part>;
  centres: Record<BodyRegion, RegionCentre>;
}

export function regionParts(src: THREE.BufferGeometry, height: number, bounds: THREE.Box3): AstronautParts {
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

  const tf = transformFor(height, bounds);
  const parts = {} as Record<PartId, Part>;
  for (const part of PART_IDS) {
    const regionIdx = REGIONS.map((r, i) => (PART_OF[r] === part ? i : -1)).filter((i) => i >= 0);
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(g.attributes)) {
      const a = g.getAttribute(name);
      const size = a.itemSize;
      const count = regionIdx.reduce((n, i) => n + buckets[i].length * 3, 0);
      const arr = new Float32Array(count * size);
      let o = 0;
      for (const i of regionIdx) {
        for (const t of buckets[i]) {
          for (let v = 0; v < 3; v++) {
            for (let k = 0; k < size; k++) arr[o++] = a.getComponent(3 * t + v, k);
          }
        }
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    let start = 0;
    for (const i of regionIdx) {
      out.addGroup(start, buckets[i].length * 3, i);
      start += buckets[i].length * 3;
    }
    tf.geometry(out);
    const pivot = tf.point(PIVOTS[part]);
    out.translate(-pivot.x, -pivot.y, -pivot.z);
    out.computeBoundingSphere();
    parts[part] = { geometry: out, pivot };
  }

  // Region centres: the mean of each region's vertices, moved into its part's local space.
  const centres = {} as Record<BodyRegion, RegionCentre>;
  REGIONS.forEach((region, i) => {
    const sum = [0, 0, 0];
    let n = 0;
    for (const t of buckets[i]) {
      for (let v = 0; v < 3; v++) {
        sum[0] += pos.getX(3 * t + v);
        sum[1] += pos.getY(3 * t + v);
        sum[2] += pos.getZ(3 * t + v);
        n++;
      }
    }
    const part = PART_OF[region];
    const world = tf.point([sum[0] / Math.max(1, n), sum[1] / Math.max(1, n), sum[2] / Math.max(1, n)]);
    centres[region] = { part, position: world.sub(parts[part].pivot) };
  });
  return { parts, centres };
}
