// Clicking a body region on the 3D astronaut: the hit face's draw group must name the region that was clicked.
// Loads the real model, builds the parts the way the 3D view does, and casts a ray at each region's centre.

import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { regionParts, REGIONS } from './astronautGeometry';

async function loadSuit() {
  const buf = readFileSync(new URL('../../public/models/astronaut-web.glb', import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new GLTFLoader().parseAsync(ab, '');
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  meshes.sort((a, b) => b.geometry.getAttribute('position').count - a.geometry.getAttribute('position').count);
  return meshes[0].geometry;
}

describe('3D astronaut body regions', () => {
  it('maps a click on each region to that region', async () => {
    const suit = await loadSuit();
    suit.computeBoundingBox();
    const { parts, centres } = regionParts(suit.clone(), 1.45, suit.boundingBox!.clone());
    const materials = REGIONS.map(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const root = new THREE.Group();
    const holders = {} as Record<string, THREE.Object3D>;
    for (const [id, part] of Object.entries(parts)) {
      // As in the 3D view: the body sits at the origin, arms and legs hang from their joints.
      const holder = new THREE.Group();
      if (id !== 'core') holder.position.copy(part.pivot);
      holder.add(new THREE.Mesh(part.geometry, materials));
      root.add(holder);
      holders[id] = holder;
    }
    root.updateMatrixWorld(true);

    const ray = new THREE.Raycaster();
    const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
    const report: Record<string, number> = {};
    for (const region of REGIONS) {
      const c = centres[region];
      const target = holders[c.part].localToWorld(c.position.clone());
      let hits = 0;
      for (const d of dirs) {
        ray.set(target.clone().addScaledVector(d, 5), d.clone().negate());
        const first = ray.intersectObject(root, true)[0];
        if (first?.face && REGIONS[first.face.materialIndex] === region) hits++;
      }
      report[region] = hits;
    }
    // From at least three of six sides, the first surface a click meets belongs to the region aimed at.
    for (const region of REGIONS) expect(report[region], `${region}: ${JSON.stringify(report)}`).toBeGreaterThanOrEqual(3);
  });
});
