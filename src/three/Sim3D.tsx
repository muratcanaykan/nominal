// 3D mission simulation: the vehicle, the crew inside or on a spacewalk, and suit regions glowing in alert colours.
// Astronaut model: NASA 3D Resources ("Astronaut"), rendered with our own materials. All data is simulated.

import { Edges, Html, Line, OrbitControls, Stars, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BodyRegion } from '../domain/body';
import { regionStates } from '../domain/bodymap';
import { CREW, type AstronautId, type ProfileId } from '../domain/crew';
import { locationOf, type LocationId } from '../domain/locations';
import { crewSummary } from '../domain/sim';
import { LEVEL_NAMES, type Level, type Status } from '../domain/vitals';
import { radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';
import { useNow, useRoom } from '../lib/useRoom';
import { orient, regionGeometry, REGIONS } from './astronautGeometry';

const MODEL_URL = '/models/astronaut-web.glb';
const HEIGHT = 1.45;
const LEVEL_COLOR: Record<Level | 'nodata', string> = { 0: '#34d399', 1: '#fcd34d', 2: '#fb923c', 3: '#fb5072', nodata: '#94a3b8' };
const ACCENT = '#7dd3fc';

// ---- vehicle layout (world units, y up, modules along x) -------------------------------------------------

interface ModuleDef {
  id: LocationId;
  label: string;
  centre: [number, number, number];
  radius: number;
  length: number;
}

const MODULES: ModuleDef[] = [
  { id: 'airlock', label: 'Airlock', centre: [-4.7, 0, 0], radius: 0.9, length: 1.7 },
  { id: 'habitat', label: 'Habitat', centre: [-0.4, 0, 0], radius: 1.3, length: 3.8 },
  { id: 'lab', label: 'Lab', centre: [3.6, 0, 0], radius: 1.3, length: 3.6 },
];

const SLOTS: Record<LocationId, [number, number, number][]> = {
  airlock: [
    [-4.95, 0, 0.1],
    [-4.45, 0, -0.1],
  ],
  habitat: [
    [-1.3, 0, 0],
    [0.5, 0, 0],
    [-0.4, 0, 0.3],
  ],
  lab: [
    [2.8, 0, 0],
    [4.4, 0, 0],
    [3.6, 0, 0.3],
  ],
  eva: [
    [0.6, 2.35, 0.9],
    [3.2, 2.25, -0.8],
    [-1.6, 2.4, -0.7],
  ],
};

const AIRLOCK_IN = new THREE.Vector3(-4.7, 0, 0);
const HATCH_OUT = new THREE.Vector3(-6.2, 0.9, 0);
const TETHER_ANCHOR = new THREE.Vector3(-5.6, 0.55, 0);

const PLANETS: Record<ProfileId, { color: string; radius: number; position: [number, number, number]; glow: string }> = {
  leo: { color: '#1d4e89', radius: 46, position: [10, -62, -70], glow: '#7dd3fc' },
  lunar: { color: '#8a8f98', radius: 16, position: [-46, -40, -95], glow: '#cbd5e1' },
  mars: { color: '#b4472a', radius: 34, position: [18, -54, -80], glow: '#fb923c' },
};

// ---- data for the scene -----------------------------------------------------------------------------------

interface CrewVisual {
  id: AstronautId;
  callsign: string;
  location: LocationId;
  slot: [number, number, number];
  status: Status;
  worst: Level;
  regions: Partial<Record<BodyRegion, Level>>;
  help: boolean;
}

function useCrewVisuals(): { crew: CrewVisual[]; profile: ProfileId; solar: boolean } {
  const { state } = useRoom();
  const now = useNow(400);
  const weather = useSpaceWeather();
  const st = state ?? undefined;
  const summary = crewSummary(st, now);
  const used: Record<LocationId, number> = { airlock: 0, habitat: 0, lab: 0, eva: 0 };
  const crew = CREW.map((a) => {
    const s = summary.snapshots[a.id];
    const location = locationOf(st, a.id);
    const slots = SLOTS[location];
    const slot = slots[used[location]++ % slots.length];
    const regions: Partial<Record<BodyRegion, Level>> = {};
    for (const [r, v] of Object.entries(regionStates(s, st))) regions[r as BodyRegion] = v.level;
    return {
      id: a.id,
      callsign: a.callsign,
      location,
      slot,
      status: s.status,
      worst: s.connected ? s.worst : 0,
      regions,
      help: !!st?.help?.[a.id],
    } satisfies CrewVisual;
  });
  return { crew, profile: st?.profile ?? 'lunar', solar: !!radiationAdvisory(st, weather, now) };
}

// ---- astronaut ------------------------------------------------------------------------------------------

function useAstronautGeometry() {
  const gltf = useGLTF(MODEL_URL, false);
  return useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    meshes.sort((a, b) => b.geometry.getAttribute('position').count - a.geometry.getAttribute('position').count);
    const suit = meshes[0].geometry;
    suit.computeBoundingBox();
    const bounds = suit.boundingBox!.clone();
    const body = regionGeometry(suit.clone(), HEIGHT, bounds);
    const visor = meshes[1] ? orient(meshes[1].geometry.clone(), HEIGHT, bounds) : null;
    return { body, visor };
  }, [gltf]);
}

function pulse(t: number, period: number) {
  return 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / period);
}

function Astronaut({
  v,
  selected,
  onSelect,
  positions,
  reduce,
}: {
  v: CrewVisual;
  selected: boolean;
  onSelect: (id: AstronautId) => void;
  positions: Map<AstronautId, THREE.Vector3>;
  reduce: boolean;
}) {
  const { body, visor } = useAstronautGeometry();
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const path = useRef<THREE.Vector3[]>([]);
  const pos = useRef(new THREE.Vector3(...v.slot));
  const prevLocation = useRef(v.location);
  const phase = useMemo(() => Number(v.id) * 1.7, [v.id]);

  const materials = useMemo(
    () =>
      REGIONS.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: '#e9eef4',
            roughness: 0.62,
            metalness: 0.05,
            emissive: new THREE.Color('#000000'),
          }),
      ),
    [],
  );
  const visorMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.9, roughness: 0.18, emissive: new THREE.Color('#000000') }),
    [],
  );
  useEffect(() => () => [...materials, visorMaterial].forEach((m) => m.dispose()), [materials, visorMaterial]);

  // Plan a route when the location changes: spacewalk moves go through the airlock.
  useEffect(() => {
    const target = new THREE.Vector3(...v.slot);
    const from = prevLocation.current;
    prevLocation.current = v.location;
    if (from === v.location) {
      path.current = [target];
      return;
    }
    if (from === 'eva' && v.location !== 'eva') path.current = [HATCH_OUT.clone(), AIRLOCK_IN.clone(), target];
    else if (from !== 'eva' && v.location === 'eva') path.current = [AIRLOCK_IN.clone(), HATCH_OUT.clone(), target];
    else path.current = [target];
  }, [v.location, v.slot]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // Walk the route at a steady pace.
    const next = path.current[0];
    if (next) {
      const d = next.clone().sub(pos.current);
      const step = Math.min(d.length(), delta * 1.8);
      if (d.length() < 0.02) path.current.shift();
      else pos.current.add(d.normalize().multiplyScalar(step));
    }
    positions.set(v.id, pos.current);
    const g = group.current;
    if (g) {
      const bob = reduce ? 0 : Math.sin(t * 0.8 + phase) * 0.05;
      g.position.set(pos.current.x, pos.current.y + bob, pos.current.z);
      const eva = v.location === 'eva';
      g.rotation.z = reduce ? 0 : Math.sin(t * 0.5 + phase) * (eva ? 0.18 : 0.05);
      g.rotation.y = (v.location === 'airlock' ? Math.PI / 2 : 0) + (reduce ? 0 : Math.sin(t * 0.3 + phase) * (eva ? 0.5 : 0.15));
      g.rotation.x = eva && !reduce ? Math.sin(t * 0.4 + phase) * 0.12 : 0;
    }

    // Region glow.
    const offline = v.status === 'nodata';
    REGIONS.forEach((region, i) => {
      const m = materials[i];
      const level = v.regions[region] ?? 0;
      m.color.set(offline ? '#6b7280' : '#e9eef4');
      if (offline || level === 0) {
        m.emissiveIntensity = 0;
        return;
      }
      m.emissive.set(LEVEL_COLOR[level]);
      const p = reduce ? 1 : level === 3 ? pulse(t, 0.8) : level === 2 ? pulse(t, 1.4) : pulse(t, 2.6);
      m.emissiveIntensity = level === 1 ? 0.35 + 0.25 * p : level === 2 ? 0.6 + 0.9 * p : 0.9 + 1.6 * p;
      m.color.lerp(new THREE.Color(LEVEL_COLOR[level]), 0.35);
    });
    const head = v.regions.head ?? 0;
    visorMaterial.emissive.set(head > 0 ? LEVEL_COLOR[head] : '#000000');
    visorMaterial.emissiveIntensity = head > 0 ? 0.5 + (reduce ? 0.5 : pulse(t, head === 3 ? 0.8 : 1.4)) : 0;

    // Halo for warning and critical, and a spinning ring for the selected astronaut.
    if (halo.current) {
      const show = !offline && (v.worst >= 2 || v.help);
      halo.current.visible = show;
      if (show) {
        const period = v.worst === 3 || v.help ? 0.9 : 1.6;
        const k = reduce ? 0.5 : (t % period) / period;
        halo.current.scale.setScalar(0.7 + k * 0.9);
        (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k);
        (halo.current.material as THREE.MeshBasicMaterial).color.set(v.help ? LEVEL_COLOR[3] : LEVEL_COLOR[v.worst]);
      }
    }
    if (ring.current) ring.current.rotation.z = t * 0.8;
  });

  const tagLevel = v.status === 'nodata' ? 'nodata' : v.worst;
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(v.id);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={body} material={materials} castShadow />
      {visor && <mesh geometry={visor} material={visorMaterial} />}
      <mesh ref={halo} visible={false}>
        <sphereGeometry args={[0.9, 32, 16]} />
        <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
      {selected && (
        <mesh ref={ring} position={[0, -HEIGHT / 2 - 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.018, 8, 64, Math.PI * 1.6]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      )}
      <Html position={[0, HEIGHT / 2 + 0.32, 0]} center distanceFactor={6} zIndexRange={[20, 0]}>
        <button
          className={`sim-tag lvl-${tagLevel}${selected ? ' is-selected' : ''}`}
          onClick={() => onSelect(v.id)}
          aria-label={`Select ${v.callsign}`}
        >
          <span className="sim-tag__dot" />
          {v.callsign}
          <small>{v.help ? 'Help' : v.status === 'nodata' ? 'No data' : LEVEL_NAMES[v.worst]}</small>
        </button>
      </Html>
    </group>
  );
}

// ---- vehicle, tether, planet, space weather ---------------------------------------------------------------

function Module({ m, level }: { m: ModuleDef; level: Level }) {
  const edge = useRef<THREE.LineBasicMaterial>(null);
  useFrame((s) => {
    if (!edge.current) return;
    if (level >= 3) edge.current.color.set(LEVEL_COLOR[3]).multiplyScalar(0.6 + pulse(s.clock.elapsedTime, 0.8));
    else edge.current.color.set(ACCENT);
  });
  return (
    <group position={m.centre}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[m.radius, m.radius, m.length, 40, 1, true]} />
        <meshStandardMaterial color="#9fd8f5" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} roughness={0.2} />
        <Edges threshold={20}>
          <lineBasicMaterial ref={edge} color={ACCENT} transparent opacity={0.55} />
        </Edges>
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * m.length) / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[m.radius, 0.045, 8, 48]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {Array.from({ length: Math.max(1, Math.round(m.length / 0.9) - 1) }, (_, i) => {
        const ribs = Math.max(1, Math.round(m.length / 0.9) - 1);
        const x = -m.length / 2 + ((i + 1) * m.length) / (ribs + 1);
        return (
          <mesh key={`rib-${i}`} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[m.radius, 0.012, 6, 48]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.25} />
          </mesh>
        );
      })}
      <Html position={[0, m.radius + 0.25, 0]} center distanceFactor={11} zIndexRange={[10, 0]}>
        <span className="sim-module">{m.label}</span>
      </Html>
    </group>
  );
}

function Vehicle({ moduleLevels }: { moduleLevels: Partial<Record<LocationId, Level>> }) {
  return (
    <group>
      {MODULES.map((m) => (
        <Module key={m.id} m={m} level={moduleLevels[m.id] ?? 0} />
      ))}
      {/* connectors */}
      {[
        [-3.2, 0.7],
        [1.65, 1.0],
      ].map(([x, r]) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r, r, 0.6, 32]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* truss and solar arrays */}
      <mesh position={[6.2, 0, 0]}>
        <boxGeometry args={[0.2, 0.2, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[6.2, 0, side * 2.9]}>
          <boxGeometry args={[1.8, 0.03, 3]} />
          <meshStandardMaterial color="#1e3a8a" metalness={0.5} roughness={0.25} emissive="#1d4ed8" emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function Tether({ positions, id }: { positions: Map<AstronautId, THREE.Vector3>; id: AstronautId }) {
  const ref = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  useFrame((s) => {
    const p = positions.get(id);
    if (!p || !ref.current) return;
    const mid = TETHER_ANCHOR.clone().lerp(p, 0.5);
    mid.y += 0.6 + Math.sin(s.clock.elapsedTime * 0.7) * 0.15;
    const curve = new THREE.QuadraticBezierCurve3(TETHER_ANCHOR, mid, p);
    ref.current.geometry.setPositions(curve.getPoints(24).flatMap((v) => [v.x, v.y, v.z]));
  });
  return (
    <Line
      ref={ref as never}
      points={[TETHER_ANCHOR, TETHER_ANCHOR.clone().add(new THREE.Vector3(0.1, 0.1, 0))]}
      color="#e2e8f0"
      lineWidth={1.2}
      transparent
      opacity={0.6}
    />
  );
}

function Planet({ profile }: { profile: ProfileId }) {
  const p = PLANETS[profile];
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.01;
  });
  return (
    <group position={p.position}>
      <mesh ref={ref}>
        <sphereGeometry args={[p.radius, 64, 32]} />
        <meshStandardMaterial color={p.color} roughness={0.95} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[p.radius, 48, 24]} />
        <meshBasicMaterial color={p.glow} transparent opacity={0.12} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Soft round sprite for particles (points are square without a texture). */
function useDotTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
}

/** Solar particle event: a stream of energetic particles from the Sun's direction. */
function SolarStream() {
  const dot = useDotTexture();
  const count = 1100;
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = -30 + Math.random() * 50;
      a[i * 3 + 1] = -6 + Math.random() * 12;
      a[i * 3 + 2] = -8 + Math.random() * 16;
    }
    return a;
  }, []);
  useFrame((_, d) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let x = arr.getX(i) + d * (6 + (i % 7));
      if (x > 20) x = -30;
      arr.setX(i, x);
    }
    arr.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={dot} color="#ffb067" size={0.16} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </points>
  );
}

const HOME_TARGET = new THREE.Vector3(0.4, 0.4, 0);
const HOME_OFFSET = new THREE.Vector3(2.6, 3, 10.8);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Orbit camera. In the overview it sways gently around a three-quarter view; selecting an astronaut flies to them.
 * Dragging takes over for a while.
 */
function CameraRig({ selected, positions, reduce }: { selected: AstronautId | null; positions: Map<AstronautId, THREE.Vector3>; reduce: boolean }) {
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const fly = useRef(0);
  const idleAt = useRef(0);
  const last = useRef<AstronautId | null | undefined>(undefined);
  const clock = useRef(0);
  useFrame((state, delta) => {
    const c = controls.current;
    if (!c) return;
    const t = state.clock.elapsedTime;
    clock.current = t;
    if (last.current !== selected) {
      last.current = selected;
      fly.current = 2;
      idleAt.current = 0;
    }
    const p = selected ? positions.get(selected) : undefined;
    const goal = p ? p.clone() : HOME_TARGET;
    c.target.lerp(goal, 0.06);
    const idle = t > idleAt.current;
    if (!p && idle) {
      const sway = reduce ? 0 : Math.sin(t * 0.12) * 0.45;
      // Narrow (phone) views step back so the whole vehicle fits.
      const back = Math.min(2.2, Math.max(1, 1.5 / (state.camera as THREE.PerspectiveCamera).aspect));
      const want = HOME_OFFSET.clone().multiplyScalar(back).applyAxisAngle(Y_AXIS, sway).add(HOME_TARGET);
      state.camera.position.lerp(want, fly.current > 0 ? 0.06 : 0.02);
    } else if (p && fly.current > 0) {
      const dir = state.camera.position.clone().sub(c.target).normalize();
      state.camera.position.lerp(goal.clone().add(dir.multiplyScalar(5)), 0.06);
    }
    fly.current = Math.max(0, fly.current - delta);
    c.update();
  });
  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping
      maxPolarAngle={Math.PI * 0.85}
      onStart={() => {
        idleAt.current = Number.POSITIVE_INFINITY;
        fly.current = 0;
      }}
      onEnd={() => {
        idleAt.current = clock.current + 12;
      }}
    />
  );
}

function Scene({ selected, onSelect, reduce }: { selected: AstronautId | null; onSelect: (id: AstronautId) => void; reduce: boolean }) {
  const { crew, profile, solar } = useCrewVisuals();
  const positions = useMemo(() => new Map<AstronautId, THREE.Vector3>(), []);
  const moduleLevels: Partial<Record<LocationId, Level>> = {};
  for (const v of crew) {
    const lvl = (v.help ? 3 : v.worst) as Level;
    moduleLevels[v.location] = Math.max(moduleLevels[v.location] ?? 0, lvl) as Level;
  }
  return (
    <>
      <color attach="background" args={['#05070b']} />
      <ambientLight intensity={solar ? 0.35 : 0.45} color={solar ? '#ffd7b0' : '#cfe8ff'} />
      <directionalLight position={[-10, 8, 6]} intensity={2.2} color="#fff4e0" />
      <directionalLight position={[8, -4, -6]} intensity={0.4} color="#7dd3fc" />
      <Stars radius={120} depth={60} count={2500} factor={4} saturation={0} fade speed={reduce ? 0 : 0.6} />
      <mesh position={[-70, 25, -40]}>
        <sphereGeometry args={[3, 32, 16]} />
        <meshBasicMaterial color="#fff1c1" toneMapped={false} />
      </mesh>
      <Planet profile={profile} />
      <Vehicle moduleLevels={moduleLevels} />
      {crew.map((v) => (
        <Astronaut key={v.id} v={v} selected={selected === v.id} onSelect={onSelect} positions={positions} reduce={reduce} />
      ))}
      {crew
        .filter((v) => v.location === 'eva')
        .map((v) => (
          <Tether key={v.id} positions={positions} id={v.id} />
        ))}
      {solar && <SolarStream />}
      <CameraRig selected={selected} positions={positions} reduce={reduce} />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette offset={0.25} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

export default function Sim3D({ selected, onSelect }: { selected: AstronautId | null; onSelect: (id: AstronautId) => void }) {
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  return (
    <Canvas
      className="sim3d__canvas"
      dpr={[1, 1.75]}
      camera={{ position: [3, 3.2, 11], fov: 40, near: 0.1, far: 400 }}
      gl={{ antialias: true }}
      aria-label="3D view of the vehicle and crew"
    >
      <Scene selected={selected} onSelect={onSelect} reduce={reduce} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL, false);
