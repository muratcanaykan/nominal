// Deterministic simulation: every screen that reads the same clock and the same room state
// computes the same indicator values, so only events need to be synced between devices.
// All values are SIMULATED for the demo.

import { CREW, CREW_BY_ID, type AstronautId } from './crew';
import { ackKey, type Override, type RoomState } from './room';
import { levelFor, VITAL_IDS, VITAL_PRIORITY, type Level, type Status, type VitalId } from './vitals';

// ---- seeded noise -------------------------------------------------------

function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rand01(seed: string, i: number): number {
  let t = (hash32(seed) ^ Math.imul(i, 0x9e3779b1)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1]. */
function smooth(seed: string, t: number, periodMs: number): number {
  const x = t / periodMs;
  const i = Math.floor(x);
  const f = x - i;
  const a = rand01(seed, i);
  const b = rand01(seed, i + 1);
  const s = (1 - Math.cos(Math.PI * f)) / 2;
  return (a + (b - a) * s) * 2 - 1;
}

const DAY_MS = 24 * 3600 * 1000;

// ---- raw simulated values ----------------------------------------------

/** The simulated value before any scenario override. `bloodPressure` returns systolic. */
export function baseValue(id: AstronautId, vital: VitalId, t: number, state?: RoomState): number {
  const a = CREW_BY_ID[id];
  const b = a.baseline;
  const seed = `${id}:${vital}`;
  switch (vital) {
    case 'heartRate':
      return b.heartRate + smooth(seed, t, 5000) * 3 + smooth(seed + ':slow', t, 40000) * 5 + (a.onEva ? smooth(seed + ':eva', t, 15000) * 5 : 0);
    case 'spo2':
      return Math.min(100, b.spo2 + smooth(seed, t, 20000) * 1);
    case 'bloodPressure':
      return b.systolic + smooth(seed, t, 30000) * 5;
    case 'bodyTemp':
      return b.bodyTemp + Math.sin((2 * Math.PI * t) / DAY_MS) * 0.2 + smooth(seed, t, 120000) * 0.08;
    case 'glucose': {
      // A CGM reports every few minutes; the demo updates every 15 s.
      const tq = Math.floor(t / 15000) * 15000;
      return b.glucose + smooth(seed, tq, 90000) * 12;
    }
    case 'sleep': {
      const day = Math.floor(t / DAY_MS);
      return b.sleep + (rand01(seed, day) * 2 - 1) * 0.3;
    }
    case 'mood':
      return state?.moods?.[id]?.value ?? 4;
  }
}

export function diastolicAt(id: AstronautId, t: number, systolic: number): number {
  const b = CREW_BY_ID[id].baseline;
  return b.diastolic + (systolic - b.systolic) * 0.55 + smooth(`${id}:dia`, t, 30000) * 2;
}

const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function applyOverride(sim: number, base: number, o: Override, t: number): number {
  if (t <= o.startAt) return sim;
  const k = easeInOut(Math.min(1, (t - o.startAt) / Math.max(1, o.rampMs)));
  // Keep a little of the natural variation once the target is reached.
  return sim * (1 - k) + (o.target + (sim - base) * 0.4) * k;
}

export function valueAt(id: AstronautId, vital: VitalId, t: number, state?: RoomState): number {
  const sim = baseValue(id, vital, t, state);
  const o = state?.overrides?.[id]?.[vital];
  if (!o || vital === 'mood') return sim;
  const b = CREW_BY_ID[id].baseline;
  const base = vital === 'bloodPressure' ? b.systolic : (b as unknown as Record<string, number>)[vital];
  return applyOverride(sim, base, o, t);
}

// ---- snapshots ----------------------------------------------------------

export interface Reading {
  id: VitalId;
  value: number;
  /** Level used for display and escalation. */
  level: Level;
  /** Diastolic pressure for `bloodPressure`. */
  secondary?: number;
  /** Glucose: the sensor is out of range and waits for a fingerstick test before escalating. */
  pending?: boolean;
  /** Glucose: the level the sensor alone would give. */
  sensorLevel?: Level;
  /** Glucose: the value comes from a fingerstick test. */
  confirmed?: boolean;
}

const GLUCOSE_CHECK_VALID_MS = 30 * 60 * 1000;

/**
 * Glucose escalation: an out-of-range sensor value stays at watch level (1) until a fingerstick test confirms it.
 * Level 3 never waits.
 */
function applyGlucoseCheck(r: Reading, state: RoomState | undefined, id: AstronautId, t: number) {
  const check = state?.glucoseChecks?.[id];
  const sensorChangedAt = state?.overrides?.[id]?.glucose?.startAt ?? 0;
  if (check && check.at >= sensorChangedAt && t - check.at < GLUCOSE_CHECK_VALID_MS) {
    r.value = check.value;
    r.level = levelFor('glucose', check.value);
    r.confirmed = true;
  } else if (r.level === 1 || r.level === 2) {
    r.sensorLevel = r.level;
    r.level = 1;
    r.pending = true;
  }
}

export interface Snapshot {
  astronautId: AstronautId;
  connected: boolean;
  /** Time of the readings (frozen at disconnect time when the device is offline). */
  readingsAt: number;
  readings: Record<VitalId, Reading>;
  worst: Level;
  status: Status;
  /** The most important reading at the worst level, if any is above nominal. */
  top?: Reading;
  /** `top`, unless the astronaut already acknowledged it. Level 3 can't be acknowledged away. */
  alert?: Reading;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export function snapshot(state: RoomState | undefined, id: AstronautId, now: number): Snapshot {
  const disconnect = state?.disconnects?.[id];
  const connected = !disconnect || disconnect.at > now;
  const t = connected ? now : disconnect!.at;

  const readings = {} as Record<VitalId, Reading>;
  for (const vital of VITAL_IDS) {
    const raw = valueAt(id, vital, t, state);
    const decimals = vital === 'bodyTemp' || vital === 'sleep' ? 1 : 0;
    const value = round(raw, decimals);
    const reading: Reading = { id: vital, value, level: levelFor(vital, value) };
    if (vital === 'bloodPressure') reading.secondary = Math.round(diastolicAt(id, t, raw));
    if (vital === 'glucose') applyGlucoseCheck(reading, state, id, t);
    readings[vital] = reading;
  }

  let top: Reading | undefined;
  for (const vital of VITAL_PRIORITY) {
    const r = readings[vital];
    if (r.level > 0 && (!top || r.level > top.level)) top = r;
  }
  const worst = (top?.level ?? 0) as Level;
  const acked = top ? state?.acks?.[id]?.[ackKey(top.id, top.level)] : undefined;
  const alert = top && (top.level === 3 || !acked) ? top : undefined;

  return {
    astronautId: id,
    connected,
    readingsAt: t,
    readings,
    worst,
    status: connected ? worst : 'nodata',
    top,
    alert,
  };
}

// ---- crew-level view (cabin screen) -------------------------------------

export interface CrewAlert {
  astronautId: AstronautId;
  kind: 'critical' | 'help';
  vital?: VitalId;
  /** When the alert started, if known. */
  since?: number;
  claimedBy?: AstronautId;
  claimedAt?: number;
}

/** Finds when an overridden indicator first reached `level` (coarse scan; ramps are a few seconds long). */
function crossingTime(state: RoomState, id: AstronautId, vital: VitalId, level: Level, now: number): number | undefined {
  const o = state.overrides?.[id]?.[vital];
  if (!o) return undefined;
  const end = Math.min(now, o.startAt + o.rampMs);
  for (let t = o.startAt; t <= end; t += 100) {
    if (levelFor(vital, valueAt(id, vital, t, state)) >= level) return t;
  }
  return end;
}

export interface CrewSummary {
  total: number;
  connected: number;
  snapshots: Record<AstronautId, Snapshot>;
  /** Only what the shared cabin screen may show: level 3 alerts and help requests. */
  alerts: CrewAlert[];
}

export function crewSummary(state: RoomState | undefined, now: number): CrewSummary {
  const snapshots = {} as Record<AstronautId, Snapshot>;
  const alerts: CrewAlert[] = [];
  let connected = 0;
  for (const a of CREW) {
    const s = snapshot(state, a.id, now);
    snapshots[a.id] = s;
    if (s.connected) connected++;
    const claim = state?.claims?.[a.id];
    const help = state?.help?.[a.id];
    if (help && help.at <= now) {
      alerts.push({ astronautId: a.id, kind: 'help', since: help.at, claimedBy: claim?.by, claimedAt: claim?.at });
    } else if (s.connected && s.worst === 3 && s.top) {
      alerts.push({
        astronautId: a.id,
        kind: 'critical',
        vital: s.top.id,
        since: state ? crossingTime(state, a.id, s.top.id, 3, now) : undefined,
        claimedBy: claim?.by,
        claimedAt: claim?.at,
      });
    }
  }
  return { total: CREW.length, connected, snapshots, alerts };
}

/** Scheduled mood check-ins, in mission-clock hours. */
export const MOOD_SLOTS_H = [7, 13, 19];
const MOOD_WINDOW_MS = 60 * 60 * 1000;

/** True when the watch should ask for a mood check-in (requested from the panel, or a scheduled slot). */
export function moodDue(state: RoomState | undefined, id: AstronautId, now: number, dayOffsetMs: number): boolean {
  if (!state) return false;
  const last = state.moods?.[id]?.at ?? -Infinity;
  const prompt = state.moodPrompts?.[id];
  if (prompt && prompt.at <= now && last < prompt.at) return true;
  const missionMs = now - state.createdAt + dayOffsetMs;
  const dayStart = missionMs - (missionMs % DAY_MS);
  const slots = [...MOOD_SLOTS_H.map((h) => dayStart + h * 3600000), ...MOOD_SLOTS_H.map((h) => dayStart - DAY_MS + h * 3600000)];
  const slot = Math.max(...slots.filter((s) => s <= missionMs));
  const slotReal = now - (missionMs - slot);
  return slotReal >= state.createdAt && now - slotReal < MOOD_WINDOW_MS && last < slotReal;
}

/** Mission elapsed time label, e.g. "D12 06:17:42". */
export function missionClock(state: RoomState | undefined, now: number, dayOffsetMs: number): string {
  const elapsed = Math.max(0, now - (state?.createdAt ?? now) + dayOffsetMs);
  const day = Math.floor(elapsed / DAY_MS) + 1;
  const rest = elapsed % DAY_MS;
  const h = Math.floor(rest / 3600000);
  const m = Math.floor((rest % 3600000) / 60000);
  const s = Math.floor((rest % 60000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `D${p(day)} ${p(h)}:${p(m)}:${p(s)}`;
}
