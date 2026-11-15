// 3D mission simulation: the vehicle, the crew inside or on a spacewalk, and suit regions glowing in alert colours.
// Spacesuit model: NASA 3D Resources ("Astronaut"), rendered with our own materials; crew inside the vehicle use the
// coverall models in public/models/crew-*.glb (see crewGeometry.ts). All data is simulated.

import { Billboard, Edges, Html, Line, OrbitControls, Stars, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BodyRegion } from '../domain/body';
import { regionStates } from '../domain/bodymap';
import { CREW, CREW_BY_ID, MISSION_DAY_OFFSET_MS, PROFILES, type AstronautId, type ProfileId } from '../domain/crew';
import { locationLabel, locationOf, type LocationId } from '../domain/locations';
import { crewSummary, missionClock } from '../domain/sim';
import { pullOf } from '../domain/tether';
import { LEVEL_NAMES, type Level, type Status } from '../domain/vitals';
import { radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';
import { useNow, useRoom } from '../lib/useRoom';
import { formatDelay } from '../components/bits';
import { MAP_ZONES, mapMarkers, type MapMarker } from '../components/CrewMap';
import { LOCATION_IDS } from '../domain/locations';
import { orient, regionParts, REGIONS, type BodyKit } from './astronautGeometry';
import { crewParts } from './crewGeometry';
import { LOCATIONS } from '../domain/locations';

const MODEL_URL = '/models/astronaut-web.glb';
/** Crew models for inside the vehicle (coverall, smart shirt and watch), one per body type. */
const CREW_MODEL_URL = { female: '/models/crew-female.glb', male: '/models/crew-male.glb' } as const;
const HEIGHT = 1.45;
/** Without the bulky spacesuit a crew member is a little smaller. */
const CREW_HEIGHT = HEIGHT * 0.94;
const SUIT_WHITE = new THREE.Color('#e9eef4');
const OFFLINE_GREY = new THREE.Color('#6b7280');
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

// One place per crew member in every location (four crew), so nobody overlaps even when everyone is in one place.
const SLOTS: Record<LocationId, [number, number, number][]> = {
  airlock: [
    [-4.95, 0, 0.1],
    [-4.45, 0, -0.1],
    [-4.7, 0.1, 0.5],
    [-4.7, -0.1, -0.5],
  ],
  habitat: [
    [-1.6, 0, 0.25],
    [0.8, 0, 0.25],
    [-1.0, -0.1, 0.65],
    [0.2, -0.1, 0.65],
  ],
  lab: [
    [2.6, 0, 0],
    [4.6, 0, 0],
    [3.6, 0, 0.4],
    [3.6, 0.1, -0.5],
  ],
  eva: [
    [0.6, 2.35, 0.9],
    [3.2, 2.25, -0.6],
    [-2.2, 2.4, 0.3],
    [5.4, 2.3, 0.6],
  ],
};

const AIRLOCK_IN = new THREE.Vector3(-4.7, 0, 0);
const HATCH_OUT = new THREE.Vector3(-6.2, 0.9, 0);
const TETHER_ANCHOR = new THREE.Vector3(-5.6, 0.55, 0);

const PLANETS: Record<ProfileId, { color: string; radius: number; position: [number, number, number]; glow: string }> = {
  leo: { color: '#1d4e89', radius: 46, position: [10, -62, -70], glow: '#7dd3fc' },
  lunar: { color: '#8a8f98', radius: 16, position: [42, -30, -100], glow: '#cbd5e1' },
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
  /** Being pulled back to the airlock by the tether (see tether.ts). */
  pulling: boolean;
}

interface ScreenInfo {
  clock: string;
  profile: string;
  connected: number;
  total: number;
  advisory: boolean;
  alerts: { name: string; location: string; help: boolean; respondedBy?: string }[];
  markers: (MapMarker & { alert: boolean; connected: boolean })[];
}

/**
 * `cabin` follows the shared cabin screen's rule: only critical alerts and help calls are visible to the whole crew.
 * Cautions and warnings (glowing regions, halos, labels, data colours) stay private there.
 */
export type SceneMode = 'sim' | 'cabin';

function useCrewVisuals(mode: SceneMode): { crew: CrewVisual[]; profile: ProfileId; solar: boolean; screen: ScreenInfo } {
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
    for (const [r, v] of Object.entries(regionStates(s, st))) {
      if (mode === 'sim' || v.level === 3) regions[r as BodyRegion] = v.level;
    }
    const worst = s.connected ? s.worst : 0;
    return {
      id: a.id,
      callsign: a.callsign,
      location,
      slot,
      status: s.status,
      worst: mode === 'sim' || worst === 3 ? worst : 0,
      regions,
      help: !!st?.help?.[a.id],
      pulling: !!pullOf(st, a.id, now)?.active,
    } satisfies CrewVisual;
  });
  const profile = st?.profile ?? 'lunar';
  const solar = !!radiationAdvisory(st, weather, now);
  const alerting = new Set(summary.alerts.map((x) => x.astronautId));
  const screen: ScreenInfo = {
    clock: missionClock(st, now, MISSION_DAY_OFFSET_MS),
    profile: PROFILES[profile].label,
    connected: summary.connected,
    total: summary.total,
    advisory: solar,
    alerts: summary.alerts.map((x) => ({
      name: CREW_BY_ID[x.astronautId].name,
      location: locationLabel(st, x.astronautId),
      help: x.kind === 'help',
      respondedBy: x.claimedBy ? CREW_BY_ID[x.claimedBy].name : undefined,
    })),
    markers: mapMarkers(st).map((m) => ({ ...m, alert: alerting.has(m.id), connected: summary.snapshots[m.id].connected })),
  };
  return { crew, profile, solar, screen };
}

// ---- astronaut ------------------------------------------------------------------------------------------

/** The spacesuit for the airlock and spacewalks, and the crew models for inside the vehicle. */
function useBodyKits(): Record<'suit' | 'female' | 'male', BodyKit> {
  const suit = useSuitKit();
  const female = useGLTF(CREW_MODEL_URL.female, false);
  const male = useGLTF(CREW_MODEL_URL.male, false);
  const crew = useMemo(() => ({ female: crewParts(female.scene, CREW_HEIGHT), male: crewParts(male.scene, CREW_HEIGHT) }), [female, male]);
  return useMemo(() => ({ suit, ...crew }), [suit, crew]);
}

function useSuitKit(): BodyKit {
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
    const { parts, centres } = regionParts(suit.clone(), HEIGHT, bounds);
    const visor = meshes[1] ? orient(meshes[1].geometry.clone(), HEIGHT, bounds) : null;
    return { parts, centres, visor, slots: REGIONS.map((region) => ({ region, color: SUIT_WHITE })), armRest: 0 };
  }, [gltf]);
}

function pulse(t: number, period: number) {
  return 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / period);
}

/** Pulsing ring that always faces the camera and draws on top, so the chosen body region is easy to spot. */
function RegionMarker({ position, ref }: { position: THREE.Vector3; ref: React.Ref<THREE.Group> }) {
  return (
    <group position={position}>
      <Billboard>
        <group ref={ref}>
          <mesh renderOrder={10} raycast={() => null}>
            <ringGeometry args={[0.075, 0.1, 40]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} transparent opacity={0.95} depthTest={false} />
          </mesh>
          <mesh renderOrder={10} raycast={() => null}>
            <circleGeometry args={[0.022, 20]} />
            <meshBasicMaterial color={ACCENT} toneMapped={false} depthTest={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

function Astronaut({
  v,
  selected,
  focusRegion,
  onSelect,
  onRegion,
  positions,
  reduce,
  mode,
}: {
  mode: SceneMode;
  /** Click on a body part of the selected astronaut (simulation only). */
  onRegion?: (id: AstronautId, region: BodyRegion) => void;
  v: CrewVisual;
  selected: boolean;
  /** Body region chosen on this astronaut: it glows in the accent colour with a marker on it. */
  focusRegion?: BodyRegion | null;
  onSelect: (id: AstronautId) => void;
  positions: Map<AstronautId, THREE.Vector3>;
  reduce: boolean;
}) {
  const kits = useBodyKits();
  // The spacesuit in the airlock and outside; inside the vehicle the crew model with coverall, smart shirt and watch.
  const kit = LOCATIONS[v.location].suited ? kits.suit : kits[CREW_BY_ID[v.id].body.sex];
  const { parts, centres, visor } = kit;
  const marker = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const path = useRef<THREE.Vector3[]>([]);
  const pos = useRef(new THREE.Vector3(...v.slot));
  const prevLocation = useRef(v.location);
  const phase = useMemo(() => Number(v.id) * 1.7, [v.id]);

  const materials = useMemo(
    () =>
      kit.slots.map(
        (slot) =>
          new THREE.MeshStandardMaterial({
            color: slot.color,
            roughness: slot.screen ? 0.3 : 0.62,
            metalness: 0.05,
            emissive: new THREE.Color('#000000'),
          }),
      ),
    [kit],
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
      // A tether pull reels the crew member in more slowly and steadily than a walk.
      const step = Math.min(d.length(), delta * (v.pulling ? 0.8 : 1.8));
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

    // Limbs: arms float half-raised in weightlessness; a help call waves, a cold hand shakes, no data hangs limp.
    const offline = v.status === 'nodata';
    const eva = v.location === 'eva';
    const sway = reduce ? 0 : Math.sin(t * 0.9 + phase) * 0.12;
    let left = -0.55 + sway;
    let right = 0.55 - sway;
    if (v.help) right = -1.3 + (reduce ? 0 : Math.sin(t * 7) * 0.4);
    if ((v.regions.leftHand ?? 0) > 0) left = -0.3 + (reduce ? 0 : Math.sin(t * 12) * 0.14);
    if ((v.regions.rightHand ?? 0) > 0 && !v.help) right = 0.3 + (reduce ? 0 : Math.sin(t * 12) * 0.14);
    if (offline) {
      left = -1.25;
      right = 1.25;
    }
    // The crew models hang their arms lower at rest than the spacesuit (arms out straight), so that is added back.
    if (armL.current) armL.current.rotation.z = left + kit.armRest;
    if (armR.current) armR.current.rotation.z = right - kit.armRest;
    const kick = reduce || offline ? 0 : Math.sin(t * 0.7 + phase) * (eva ? 0.2 : 0.1);
    if (legL.current) legL.current.rotation.x = kick;
    if (legR.current) legR.current.rotation.x = -kick;

    // Region glow. Each material keeps its own colour (suit white, coverall blue, skin, hair…) and lights up in the
    // alert colour of its body region. The watch screen shows the wearer's overall status colour.
    kit.slots.forEach((slot, i) => {
      const m = materials[i];
      const level = v.regions[slot.region] ?? 0;
      m.color.copy(slot.color);
      if (offline) m.color.lerp(OFFLINE_GREY, 0.7);
      if (slot.screen) {
        m.emissive.set(offline ? '#000000' : LEVEL_COLOR[v.worst]);
        m.emissiveIntensity = offline ? 0 : v.worst >= 2 && !reduce ? 0.6 + 0.8 * pulse(t, 1) : 0.9;
        return;
      }
      if (offline || level === 0) {
        m.emissiveIntensity = 0;
        return;
      }
      m.emissive.set(LEVEL_COLOR[level]);
      const p = reduce ? 1 : level === 3 ? pulse(t, 0.8) : level === 2 ? pulse(t, 1.4) : pulse(t, 2.6);
      m.emissiveIntensity = level === 1 ? 0.35 + 0.25 * p : level === 2 ? 0.6 + 0.9 * p : 0.9 + 1.6 * p;
      m.color.lerp(new THREE.Color(LEVEL_COLOR[level]), 0.35);
    });
    // The chosen region glows in the accent colour (on top of any alert colour) and its marker pulses.
    if (focusRegion && !offline) {
      const p = reduce ? 1 : pulse(t, 1.1);
      kit.slots.forEach((slot, i) => {
        if (slot.region !== focusRegion || slot.screen) return;
        const m = materials[i];
        m.emissive.set(ACCENT);
        m.emissiveIntensity = 0.7 + 0.9 * p;
        m.color.copy(slot.color).lerp(new THREE.Color(ACCENT), 0.45);
      });
    }
    if (marker.current) {
      const k = reduce ? 1 : 1 + 0.25 * Math.sin(t * 5);
      marker.current.scale.setScalar(k);
    }
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
        // Each body mesh has one draw group per region; the hit face tells which region was clicked.
        const index = e.face?.materialIndex;
        const region = index !== undefined ? kit.slots[index]?.region : undefined;
        if (selected && onRegion && region) onRegion(v.id, region);
        else onSelect(v.id);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh geometry={parts.core.geometry} material={materials} />
      {focusRegion && centres[focusRegion].part === 'core' && <RegionMarker ref={marker} position={centres[focusRegion].position} />}
      <group ref={armL} position={parts.armL.pivot}>
        <mesh geometry={parts.armL.geometry} material={materials} />
        {focusRegion && centres[focusRegion].part === 'armL' && <RegionMarker ref={marker} position={centres[focusRegion].position} />}
      </group>
      <group ref={armR} position={parts.armR.pivot}>
        <mesh geometry={parts.armR.geometry} material={materials} />
        {focusRegion && centres[focusRegion].part === 'armR' && <RegionMarker ref={marker} position={centres[focusRegion].position} />}
      </group>
      <group ref={legL} position={parts.legL.pivot}>
        <mesh geometry={parts.legL.geometry} material={materials} />
        {focusRegion && centres[focusRegion].part === 'legL' && <RegionMarker ref={marker} position={centres[focusRegion].position} />}
      </group>
      <group ref={legR} position={parts.legR.pivot}>
        <mesh geometry={parts.legR.geometry} material={materials} />
        {focusRegion && centres[focusRegion].part === 'legR' && <RegionMarker ref={marker} position={centres[focusRegion].position} />}
      </group>
      {visor && <mesh geometry={visor} material={visorMaterial} />}
      <mesh ref={halo} visible={false} raycast={() => null}>
        <sphereGeometry args={[0.9, 32, 16]} />
        <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
      {selected && (
        <mesh ref={ring} position={[0, -HEIGHT / 2 - 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
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
          {(mode === 'sim' || v.help || v.status === 'nodata' || v.worst === 3) && (
            <small>{v.help ? 'Help' : v.status === 'nodata' ? 'No data' : LEVEL_NAMES[v.worst]}</small>
          )}
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
      {/* An even number of ribs keeps the module centre (where the cabin screen hangs) clear. */}
      {Array.from({ length: Math.max(2, Math.round(m.length / 0.9)) }, (_, i) => {
        const ribs = Math.max(2, Math.round(m.length / 0.9));
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

/** Safety tether from the hatch to a spacewalker; taut and lit while the reel pulls them in. */
function Tether({ positions, id, pulling }: { positions: Map<AstronautId, THREE.Vector3>; id: AstronautId; pulling: boolean }) {
  const ref = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null);
  useFrame((s) => {
    const p = positions.get(id);
    if (!p || !ref.current) return;
    const mid = TETHER_ANCHOR.clone().lerp(p, 0.5);
    if (!pulling) mid.y += 0.6 + Math.sin(s.clock.elapsedTime * 0.7) * 0.15;
    const curve = new THREE.QuadraticBezierCurve3(TETHER_ANCHOR, mid, p);
    ref.current.geometry.setPositions(curve.getPoints(24).flatMap((v) => [v.x, v.y, v.z]));
  });
  return (
    <Line
      ref={ref as never}
      points={[TETHER_ANCHOR, TETHER_ANCHOR.clone().add(new THREE.Vector3(0.1, 0.1, 0))]}
      color={pulling ? ACCENT : '#e2e8f0'}
      lineWidth={pulling ? 2.4 : 1.2}
      transparent
      opacity={pulling ? 0.95 : 0.6}
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


// ---- cabin screen inside the habitat ------------------------------------------------------------------------

const SCREEN_POS = new THREE.Vector3(-0.4, 0.15, -0.95);
const SCREEN_W = 1.25;
const SCREEN_H = 0.7;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws a small version of the cabin screen (same rules: no health values, only alerts that need the crew). */
function drawScreen(ctx: CanvasRenderingContext2D, info: ScreenInfo) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const font = (w: number, px: number) => `${w} ${px}px Manrope, system-ui, sans-serif`;
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f3f6fa';
  ctx.font = font(800, 30);
  ctx.fillText('NOMINAL', 36, 54);
  ctx.fillStyle = '#9aa8b8';
  ctx.font = font(500, 22);
  ctx.fillText('Crew health', 190, 54);
  ctx.textAlign = 'right';
  ctx.fillText(`${info.clock} · ${info.profile}`, W - 36, 54);
  ctx.textAlign = 'left';

  const alert = info.alerts.length > 0;
  const tone = alert ? '#fb5072' : info.advisory ? '#fb923c' : '#34d399';
  roundRect(ctx, 32, 80, W - 64, 74, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.fillStyle = tone;
  ctx.fillRect(32, 80, 8, 74);
  ctx.font = font(700, 32);
  const status = alert
    ? `${info.alerts.length} crew alert${info.alerts.length > 1 ? 's' : ''}${info.advisory ? ' · radiation advisory' : ''}`
    : info.advisory
      ? 'Radiation advisory'
      : 'No active crew alerts';
  ctx.fillText(status, 60, 128);
  ctx.fillStyle = '#9aa8b8';
  ctx.font = font(500, 22);
  ctx.textAlign = 'right';
  ctx.fillText(`${info.connected}/${info.total} devices connected`, W - 56, 126);
  ctx.textAlign = 'left';

  let y = 176;
  const first = info.alerts[0];
  if (first) {
    roundRect(ctx, 32, y, W - 64, 150, 18);
    ctx.fillStyle = 'rgba(251,80,114,0.16)';
    ctx.fill();
    ctx.strokeStyle = '#fb5072';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#fb5072';
    ctx.font = font(800, 22);
    ctx.fillText(first.help ? 'HELP REQUESTED' : 'HELP NEEDED', 60, y + 40);
    ctx.fillStyle = '#f3f6fa';
    ctx.font = font(800, 44);
    ctx.fillText(first.name, 60, y + 92);
    ctx.fillStyle = '#9aa8b8';
    ctx.font = font(500, 22);
    ctx.fillText(first.respondedBy ? `${first.location} · ${first.respondedBy} is responding` : first.location, 60, y + 128);
    y += 170;
  }
  // Crew location map (same layout as the cabin screen's map).
  const area = { x: 32, y, w: W - 64, h: H - y - 20 };
  const k = Math.min(area.w / 600, area.h / 170);
  const ox = area.x + (area.w - 600 * k) / 2;
  const oy = area.y + (area.h - 170 * k) / 2;
  const X = (v: number) => ox + v * k;
  const Y = (v: number) => oy + v * k;
  ctx.lineWidth = 2;
  for (const loc of LOCATION_IDS) {
    const z = MAP_ZONES[loc];
    roundRect(ctx, X(z.x), Y(z.y), z.w * k, z.h * k, (loc === 'eva' ? 14 : 20) * k);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.setLineDash(loc === 'eva' ? [10, 8] : []);
    ctx.strokeStyle = 'rgba(125,211,252,0.45)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(125,211,252,0.85)';
    ctx.font = font(700, Math.round(11 * k));
    ctx.fillText(z.label.toUpperCase(), X(z.x + 12), Y(z.y + 18));
  }
  for (const m of info.markers) {
    if (m.alert) {
      ctx.beginPath();
      ctx.arc(X(m.x), Y(m.y), 16 * k, 0, Math.PI * 2);
      ctx.strokeStyle = '#fb5072';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(X(m.x), Y(m.y), 10 * k, 0, Math.PI * 2);
    ctx.fillStyle = m.connected ? m.color : '#64748b';
    ctx.fill();
    ctx.fillStyle = m.alert ? '#fb5072' : m.connected ? '#f3f6fa' : '#94a3b8';
    ctx.font = font(700, Math.round(11 * k));
    ctx.textAlign = 'center';
    ctx.fillText(m.callsign, X(m.x), Y(m.y + 26));
    ctx.textAlign = 'left';
  }
}

function CabinScreen3D({ info, focused, onOpen }: { info: ScreenInfo; focused: boolean; onOpen?: () => void }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 576;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const frame = useRef<THREE.MeshStandardMaterial>(null);
  const signature = JSON.stringify({ ...info, clock: info.clock.slice(0, -3) });
  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScreen(ctx, JSON.parse(signature) as ScreenInfo);
    texture.needsUpdate = true;
  }, [signature, canvas, texture]);
  useEffect(() => () => texture.dispose(), [texture]);
  const alert = info.alerts.length > 0;
  useFrame((s) => {
    if (!frame.current) return;
    frame.current.emissive.set(alert ? LEVEL_COLOR[3] : ACCENT);
    frame.current.emissiveIntensity = alert ? 0.6 + 1.4 * pulse(s.clock.elapsedTime, 0.9) : 0.35;
  });
  return (
    <group
      position={SCREEN_POS}
      onClick={
        onOpen
          ? (e) => {
              e.stopPropagation();
              onOpen();
            }
          : undefined
      }
      onPointerOver={onOpen ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onOpen ? () => (document.body.style.cursor = '') : undefined}
    >
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[SCREEN_W + 0.08, SCREEN_H + 0.08, 0.03]} />
        <meshStandardMaterial ref={frame} color="#1f2937" metalness={0.6} roughness={0.4} emissive={ACCENT} />
      </mesh>
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {!focused && onOpen && (
        <Html position={[0, SCREEN_H / 2 + 0.16, 0]} center distanceFactor={7} zIndexRange={[15, 0]}>
          <button className="sim-tag sim-tag--screen" onClick={onOpen}>
            Cabin screen <small>open</small>
          </button>
        </Html>
      )}
    </group>
  );
}

// ---- data flow: telemetry to the vehicle, alerts to the medical officer, the cabin screen and Earth -------------

const ROUTER = new THREE.Vector3(-0.4, 1.75, 0);
// Upper left of the default view, so Earth is in frame on lunar and Mars missions.
const EARTH_FAR = new THREE.Vector3(-38, 4, -52);

/** Keeps an HTML label inside the 3D view: off-screen targets stick to the nearest edge. */
const projected = new THREE.Vector3();
function clampToView(el: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }): [number, number] {
  const p = projected.setFromMatrixPosition(el.matrixWorld).project(camera);
  let x = (p.x * size.width) / 2 + size.width / 2;
  let y = (-p.y * size.height) / 2 + size.height / 2;
  if (p.z > 1) {
    x = size.width - x;
    y = size.height - y;
  }
  return [Math.min(size.width - 150, Math.max(150, x)), Math.min(size.height - 26, Math.max(26, y))];
}

function Pulses({ from, to, color, count = 3, speed = 0.5, size = 0.05 }: { from: () => THREE.Vector3 | undefined; to: () => THREE.Vector3 | undefined; color: string; count?: number; speed?: number; size?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((s) => {
    const a = from();
    const b = to();
    refs.current.forEach((m, i) => {
      if (!m) return;
      if (!a || !b) {
        m.visible = false;
        return;
      }
      const k = (s.clock.elapsedTime * speed + i / count) % 1;
      m.visible = true;
      m.position.lerpVectors(a, b, k);
      m.position.y += Math.sin(k * Math.PI) * 0.25;
      m.scale.setScalar(0.6 + Math.sin(k * Math.PI) * 0.6);
    });
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)}>
          <sphereGeometry args={[size, 12, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function Antenna() {
  return (
    <group position={[ROUTER.x, 1.3, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.12, 24, 1, true]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function DataFlow({ crew, positions, profile, mode }: { crew: CrewVisual[]; positions: Map<AstronautId, THREE.Vector3>; profile: ProfileId; mode: SceneMode }) {
  const cmo = CREW.find((c) => c.cmo);
  const toCmo = crew.some((v) => v.status !== 'nodata' && (v.worst >= 2 || v.help));
  const critical = crew.some((v) => v.status !== 'nodata' && (v.worst === 3 || v.help));
  const planet = PLANETS[profile];
  const earth = useMemo(() => {
    if (profile !== 'leo') return EARTH_FAR.clone();
    const c = new THREE.Vector3(...planet.position);
    return c.clone().add(ROUTER.clone().sub(c).normalize().multiplyScalar(planet.radius));
  }, [profile, planet]);
  const delay = PROFILES[profile].earthDelayMs;
  // The pulse to Earth moves slower the longer the real delay (scaled for the demo).
  const earthSpeed = delay > 60_000 ? 0.08 : delay > 1000 ? 0.25 : 0.45;
  const router = () => ROUTER;
  return (
    <>
      <Antenna />
      {crew
        .filter((v) => v.status !== 'nodata')
        .map((v) => (
          <Pulses
            key={v.id}
            from={() => positions.get(v.id)}
            to={router}
            color={mode === 'cabin' && !v.help && v.worst < 3 ? ACCENT : LEVEL_COLOR[v.help ? 3 : v.worst]}
            count={2}
            speed={0.45}
            size={0.045}
          />
        ))}
      {mode === 'sim' && toCmo && cmo && <Pulses from={router} to={() => positions.get(cmo.id)} color={LEVEL_COLOR[2]} count={3} speed={0.6} size={0.06} />}
      {critical && <Pulses from={router} to={() => SCREEN_POS} color={LEVEL_COLOR[3]} count={3} speed={0.7} size={0.06} />}
      <Line points={[ROUTER, earth]} color={critical ? LEVEL_COLOR[3] : ACCENT} lineWidth={1} dashed dashSize={0.6} gapSize={0.5} transparent opacity={critical ? 0.7 : 0.25} />
      {critical && <Pulses from={router} to={() => earth} color={LEVEL_COLOR[3]} count={4} speed={earthSpeed} size={0.35} />}
      {profile !== 'leo' && (
        <mesh position={EARTH_FAR}>
          <sphereGeometry args={[1.8, 32, 16]} />
          <meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={0.5} />
        </mesh>
      )}
      {/* No distanceFactor: the label keeps the same readable size at any zoom. */}
      <Html
        position={earth.clone().add(new THREE.Vector3(0, profile === 'leo' ? 6 : 4, 0))}
        center
        zIndexRange={[10, 0]}
        calculatePosition={clampToView}
      >
        <span className={`sim-earth${critical ? ' is-alert' : ''}`}>
          Earth · {formatDelay(delay)}
          {critical ? ' · flight surgeons notified' : ''}
        </span>
      </Html>
    </>
  );
}

const HOME_TARGET = new THREE.Vector3(0.4, 0.4, 0);
const HOME_OFFSET = new THREE.Vector3(2.6, 3, 10.8);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Orbit camera. The target follows the selection (an astronaut, the cabin screen or the whole vehicle) and the
 * distance follows the zoom. In the overview the view sways gently; dragging takes over for a while.
 */
function CameraRig({
  selected,
  positions,
  reduce,
  focusScreen,
  zoom,
}: {
  selected: AstronautId | null;
  positions: Map<AstronautId, THREE.Vector3>;
  reduce: boolean;
  focusScreen: boolean;
  zoom: { current: number };
}) {
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const idleAt = useRef(0);
  const last = useRef<string | undefined>(undefined);
  const clock = useRef(0);
  useFrame((state) => {
    const c = controls.current;
    if (!c) return;
    const t = state.clock.elapsedTime;
    clock.current = t;
    const key = `${selected}-${focusScreen}`;
    if (last.current !== key) {
      last.current = key;
      idleAt.current = 0;
    }
    const cam = state.camera as THREE.PerspectiveCamera;
    const p = !focusScreen && selected ? positions.get(selected) : undefined;
    const goal = focusScreen ? SCREEN_POS : p ? p : HOME_TARGET;
    c.target.lerp(goal, focusScreen ? 0.08 : 0.06);

    // Direction: the user's own angle, or the swaying overview angle when idle, or straight at the screen.
    const offset = cam.position.clone().sub(c.target);
    let dir = offset.clone().normalize();
    if (focusScreen) dir.lerp(new THREE.Vector3(0, 0.02, 1), 0.08).normalize();
    else if (!p && t > idleAt.current) {
      const sway = reduce ? 0 : Math.sin(t * 0.12) * 0.45;
      dir = dir.lerp(HOME_OFFSET.clone().applyAxisAngle(Y_AXIS, sway).normalize(), 0.03).normalize();
    }
    // Narrow (phone) views step back so the whole vehicle fits.
    const back = Math.min(2.2, Math.max(1, 1.5 / cam.aspect));
    const base = focusScreen ? 2.4 : p ? 5 : HOME_OFFSET.length() * back;
    const wanted = base * (focusScreen ? Math.min(1, zoom.current) : zoom.current);
    const dist = THREE.MathUtils.lerp(offset.length(), wanted, 0.08);
    cam.position.copy(c.target).add(dir.multiplyScalar(dist));
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
      }}
      onEnd={() => {
        idleAt.current = clock.current + 12;
      }}
    />
  );
}

interface SceneProps {
  /** `sim` for the simulation; `cabin` for the cabin screen (shared, so only crew alerts show). Default `sim`. */
  mode?: SceneMode;
  /** False pauses rendering, for example while the view is scrolled out of sight. */
  active?: boolean;
  /** `light` renders fewer pixels and skips multisampling, for full screen on large displays. */
  quality?: 'normal' | 'light';
  /** Camera distance multiplier, changed by the wheel and the + / - buttons outside the canvas. */
  zoom: { current: number };
  selected: AstronautId | null;
  onSelect: (id: AstronautId) => void;
  focusScreen: boolean;
  onScreenClick?: () => void;
  /** Click on a body part of the selected astronaut. */
  onRegion?: (id: AstronautId, region: BodyRegion) => void;
  /** Body region of the selected astronaut shown in detail; it is highlighted in 3D. */
  focusRegion?: BodyRegion | null;
}

function Scene({
  selected,
  onSelect,
  onRegion,
  focusRegion = null,
  focusScreen,
  onScreenClick,
  zoom,
  reduce,
  mode = 'sim',
  quality = 'normal',
}: SceneProps & { reduce: boolean }) {
  const { crew, profile, solar, screen } = useCrewVisuals(mode);
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
        <Astronaut
          key={v.id}
          v={v}
          selected={selected === v.id}
          focusRegion={selected === v.id ? focusRegion : null}
          onSelect={onSelect}
          onRegion={mode === 'sim' ? onRegion : undefined}
          positions={positions}
          reduce={reduce}
          mode={mode}
        />
      ))}
      {crew
        .filter((v) => v.location === 'eva' || v.pulling)
        .map((v) => (
          <Tether key={v.id} positions={positions} id={v.id} pulling={v.pulling} />
        ))}
      {solar && <SolarStream />}
      <CabinScreen3D info={screen} focused={focusScreen} onOpen={mode === 'sim' ? onScreenClick : undefined} />
      <DataFlow crew={crew} positions={positions} profile={profile} mode={mode} />
      <CameraRig selected={selected} positions={positions} reduce={reduce} focusScreen={focusScreen} zoom={zoom} />
      {/* The cabin view skips post-processing to stay light next to the main simulation. */}
      {mode === 'sim' && (
        <EffectComposer multisampling={quality === 'light' ? 0 : 4}>
          <Bloom intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.25} darkness={0.7} />
        </EffectComposer>
      )}
    </>
  );
}

export default function Sim3D(props: SceneProps) {
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  return (
    <Canvas
      className="sim3d__canvas"
      // Pixel ratio caps keep large screens smooth: full screen renders at most 1.25×, the page view 1.5×.
      dpr={props.mode === 'cabin' || props.quality === 'light' ? [1, 1.25] : [1, 1.5]}
      frameloop={props.active === false ? 'never' : 'always'}
      camera={{ position: [3, 3.2, 11], fov: 40, near: 0.1, far: 400 }}
      gl={{ antialias: true }}
      aria-label="3D view of the vehicle and crew"
    >
      <Scene {...props} reduce={reduce} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL, false);
useGLTF.preload(CREW_MODEL_URL.female, false);
useGLTF.preload(CREW_MODEL_URL.male, false);
