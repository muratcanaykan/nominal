// Clicking a body region on the 3D astronaut: the hit face's draw group must name the region that was clicked.
// Loads the real model, builds the parts the way the 3D view does, and casts a ray at each region's centre.

import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { regionParts, REGIONS, type BodyKit } from './astronautGeometry';
import { crewParts } from './crewGeometry';

async function loadModel(file: string) {
  const buf = readFileSync(new URL(`../../public/models/${file}`, import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new GLTFLoader().parseAsync(ab, '');
}

async function loadSuit() {
  const gltf = await loadModel('astronaut-web.glb');
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

/** Casts rays at each region's centre from six sides; returns how many first hits land on that region. */
function hitsPerRegion(kit: Pick<BodyKit, 'parts' | 'centres'>, regionOf: (materialIndex: number) => string | undefined, armRest = 0) {
  const materials = Array.from({ length: 64 }, () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const root = new THREE.Group();
  const holders = {} as Record<string, THREE.Object3D>;
  for (const [id, part] of Object.entries(kit.parts)) {
    const holder = new THREE.Group();
    if (id !== 'core') holder.position.copy(part.pivot);
    // The arms float half raised, as in the 3D view (0.55 rad below horizontal).
    if (id === 'armL') holder.rotation.z = -0.55 + armRest;
    if (id === 'armR') holder.rotation.z = 0.55 - armRest;
    holder.add(new THREE.Mesh(part.geometry, materials));
    root.add(holder);
    holders[id] = holder;
  }
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
  const report: Record<string, number> = {};
  for (const region of REGIONS) {
    const c = kit.centres[region];
    const target = holders[c.part].localToWorld(c.position.clone());
    let hits = 0;
    for (const d of dirs) {
      ray.set(target.clone().addScaledVector(d, 5), d.clone().negate());
      const first = ray.intersectObject(root, true)[0];
      if (first?.face && regionOf(first.face.materialIndex) === region) hits++;
    }
    report[region] = hits;
  }
  return report;
}

describe('3D crew models inside the vehicle', () => {
  for (const file of ['crew-female.glb', 'crew-male.glb']) {
    it(`${file}: every body region is found by name and can be clicked`, async () => {
      const gltf = await loadModel(file);
      const kit = crewParts(gltf.scene, 1.36);
      // Arms hang about 24° from the body, so about 66° below horizontal.
      expect(kit.armRest).toBeGreaterThan(1.0);
      expect(kit.armRest).toBeLessThan(1.3);
      for (const region of REGIONS) expect(kit.slots.some((s) => s.region === region), region).toBe(true);
      expect(kit.slots.filter((s) => s.screen)).toHaveLength(1);
      expect(kit.slots.find((s) => s.screen)?.region).toBe('leftHand');
      const report = hitsPerRegion(kit, (i) => kit.slots[i]?.region, kit.armRest);
      // The arms hang beside the chest and the shoulders sit between the coverall and the sleeves, so those are
      // reachable from fewer sides (the chest from the front and the back).
      for (const region of REGIONS) {
        const min = region === 'chest' || region.endsWith('Shoulder') ? 2 : 3;
        expect(report[region], `${region}: ${JSON.stringify(report)}`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
