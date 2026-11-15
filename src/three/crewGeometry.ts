// Crew models for inside the vehicle: coverall over a smart shirt, and the watch, without the spacesuit. Every part of
// these models is a named mesh with its own colour, so body regions come from the part names. Like the spacesuit, the
// arms turn at the shoulders and the legs at the hips.
// Model space (as delivered): y is up, the face looks toward +z, the crew member's left hand is at +x, arms hang in an
// A-pose, sizes in metres.

import * as THREE from 'three';
import type { BodyRegion } from '../domain/body';
import { PART_IDS, PART_OF, REGIONS, type BodyKit, type Part, type PartId, type RegionCentre, type Slot } from './astronautGeometry';

/** Body region of a named part of the crew model; `left` says which side of the body it is on. */
export function regionOfPart(name: string, left: boolean): BodyRegion {
  const side = (l: BodyRegion, r: BodyRegion) => (left ? l : r);
  if (/^(head|neck|ear|eye|brow|nose|mouth|hair|ponytail)/.test(name)) return 'head';
  if (/^(coverall_leg|cuff_ankle|shoe|pocket_thigh)/.test(name)) return side('leftLeg', 'rightLeg');
  if (/^coverall_shoulder/.test(name)) return side('leftShoulder', 'rightShoulder');
  if (/^(coverall_arm|cuff_wrist)/.test(name)) return side('leftArm', 'rightArm');
  if (/^(hand|thumb|watch)/.test(name)) return side('leftHand', 'rightHand');
  return 'chest';
}

interface Piece {
  name: string;
  region: BodyRegion;
  slot: number;
  color: THREE.Color;
  screen: boolean;
  geometry: THREE.BufferGeometry;
}

/** The triangles of a non-indexed geometry for which `keep` is true, as a new geometry. */
function pickTriangles(g: THREE.BufferGeometry, keep: (centroid: THREE.Vector3) => boolean): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const p: number[] = [];
  const n: number[] = [];
  const c = new THREE.Vector3();
  for (let t = 0; t < pos.count / 3; t++) {
    c.set(0, 0, 0);
    for (let v = 0; v < 3; v++) c.add(new THREE.Vector3(pos.getX(3 * t + v), pos.getY(3 * t + v), pos.getZ(3 * t + v)));
    if (!keep(c.divideScalar(3))) continue;
    for (let v = 0; v < 3; v++) {
      p.push(pos.getX(3 * t + v), pos.getY(3 * t + v), pos.getZ(3 * t + v));
      n.push(nor.getX(3 * t + v), nor.getY(3 * t + v), nor.getZ(3 * t + v));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return out;
}

/** Builds the moving parts, region centres and colour slots of a crew model scaled to `height`. */
export function crewParts(scene: THREE.Object3D, height: number): BodyKit {
  scene.updateMatrixWorld(true);
  const slots: Slot[] = [];
  const slotIndex = new Map<string, number>();
  const slotFor = (region: BodyRegion, color: THREE.Color, screen: boolean) => {
    const key = `${region}|${color.getHexString()}|${screen}`;
    if (!slotIndex.has(key)) {
      slotIndex.set(key, slots.length);
      slots.push({ region, color, screen });
    }
    return slotIndex.get(key)!;
  };
  let pieces: Piece[] = [];

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    // The model has no normals: round parts get smooth shading, small boxy parts (pockets, tapes) flat shading.
    const small = g.getAttribute('position').count <= 130;
    if (!small) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    if (small) g.computeVertexNormals();
    g.computeBoundingBox();
    const name = mesh.name || mesh.parent?.name || '';
    const left = g.boundingBox!.getCenter(new THREE.Vector3()).x > 0;
    const region = regionOfPart(name, left);
    const color = ((mesh.material as THREE.MeshStandardMaterial).color ?? new THREE.Color('#888888')).clone();
    const screen = name === 'watch_screen';
    pieces.push({ name, region, slot: -1, color, screen, geometry: g });
  });

  // Centre on the model and scale to `height`.
  const bounds = new THREE.Box3();
  for (const p of pieces) bounds.union(p.geometry.boundingBox!);
  const centre = bounds.getCenter(new THREE.Vector3());
  const s = height / bounds.getSize(new THREE.Vector3()).y;
  for (const p of pieces) {
    p.geometry.translate(-centre.x, -centre.y, -centre.z);
    p.geometry.scale(s, s, s);
    p.geometry.computeBoundingBox();
  }
  const boxOf = (name: string) => pieces.find((p) => p.name === name)?.geometry.boundingBox ?? null;
  const centreOf = (name: string, fallback: THREE.Vector3) => boxOf(name)?.getCenter(new THREE.Vector3()) ?? fallback;

  // Joints: the shoulder balls for the arms, the top of each trouser leg for the legs.
  const hip = (name: string, x: number) => {
    const b = boxOf(name);
    return b ? new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - 0.03 * height, 0) : new THREE.Vector3(x, 0, 0);
  };
  const pivots: Record<PartId, THREE.Vector3> = {
    core: new THREE.Vector3(),
    armL: centreOf('coverall_shoulder_left', new THREE.Vector3(0.1, 0.3, 0)),
    armR: centreOf('coverall_shoulder_right', new THREE.Vector3(-0.1, 0.3, 0)),
    legL: hip('coverall_leg_left', 0.05),
    legR: hip('coverall_leg_right', -0.05),
  };

  // The shoulder balls sit inside the coverall, so the top corners of the coverall around them count as the shoulders.
  const reach = 0.075 * height;
  pieces = pieces.flatMap((p) => {
    if (p.region !== 'chest') return [p];
    const near = (c: THREE.Vector3, side: 'armL' | 'armR') => c.distanceTo(pivots[side]) < reach;
    const split: Piece[] = [
      { ...p, geometry: pickTriangles(p.geometry, (c) => !near(c, 'armL') && !near(c, 'armR')) },
      { ...p, region: 'leftShoulder', geometry: pickTriangles(p.geometry, (c) => near(c, 'armL')) },
      { ...p, region: 'rightShoulder', geometry: pickTriangles(p.geometry, (c) => !near(c, 'armL') && near(c, 'armR')) },
    ];
    p.geometry.dispose();
    return split.filter((x) => x.geometry.getAttribute('position').count > 0);
  });
  for (const p of pieces) p.slot = slotFor(p.region, p.color, p.screen);

  // How far the arms hang below horizontal: the 3D view's arm angles assume arms held out straight (T-pose).
  const hand = centreOf('hand_left', pivots.armL.clone().add(new THREE.Vector3(0.1, -0.3, 0)));
  const armRest = Math.atan2(pivots.armL.y - hand.y, hand.x - pivots.armL.x);

  const parts = {} as Record<PartId, Part>;
  for (const part of PART_IDS) {
    const own = pieces.filter((p) => PART_OF[p.region] === part).sort((a, b) => a.slot - b.slot);
    const count = own.reduce((n, p) => n + p.geometry.getAttribute('position').count, 0);
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const out = new THREE.BufferGeometry();
    let o = 0;
    let groupStart = 0;
    let groupSlot = -1;
    for (const p of own) {
      const pos = p.geometry.getAttribute('position');
      const nor = p.geometry.getAttribute('normal');
      if (p.slot !== groupSlot) {
        if (groupSlot >= 0) out.addGroup(groupStart, o - groupStart, groupSlot);
        groupStart = o;
        groupSlot = p.slot;
      }
      for (let i = 0; i < pos.count; i++, o++) {
        position.set([pos.getX(i), pos.getY(i), pos.getZ(i)], o * 3);
        normal.set([nor.getX(i), nor.getY(i), nor.getZ(i)], o * 3);
      }
    }
    if (groupSlot >= 0) out.addGroup(groupStart, o - groupStart, groupSlot);
    out.setAttribute('position', new THREE.BufferAttribute(position, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    const pivot = pivots[part];
    out.translate(-pivot.x, -pivot.y, -pivot.z);
    out.computeBoundingSphere();
    parts[part] = { geometry: out, pivot };
  }

  // Region centres: the mean of each region's vertices, in its part's local space.
  const centres = {} as Record<BodyRegion, RegionCentre>;
  for (const region of REGIONS) {
    const sum = new THREE.Vector3();
    let n = 0;
    for (const p of pieces) {
      if (p.region !== region) continue;
      const pos = p.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++, n++) sum.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    const part = PART_OF[region];
    centres[region] = { part, position: sum.divideScalar(Math.max(1, n)).sub(pivots[part]) };
  }

  for (const p of pieces) p.geometry.dispose();
  return { parts, centres, slots, visor: null, armRest };
}
