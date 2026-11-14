// Demo scenarios: one click moves an astronaut's indicators so every screen shows the same story.

import type { PainSite } from './body';
import type { AstronautId } from './crew';
import type { Patch, RoomState } from './room';
import type { VitalId } from './vitals';

export type ScenarioId =
  | 'nominal'
  | 'caution'
  | 'warning'
  | 'critical'
  | 'fever'
  | 'lowGlucose'
  | 'nodata'
  | 'coldHand'
  | 'shoulderPressure'
  | 'helmetCO2'
  | 'helmetWater'
  | 'kneePain'
  | 'slowSpo2'
  | 'slowCO2';

export interface Scenario {
  id: ScenarioId;
  label: string;
  targets?: Partial<Record<VitalId, number>>;
  disconnect?: boolean;
  /** A symptom the crew member reports on the watch. */
  report?: { jointPain: { value: number; site: PainSite } };
  /** Needs the spacesuit (airlock or spacewalk). */
  suit?: boolean;
  /** How long the readings take to reach their targets (default 4 s); slow changes show the early warning. */
  rampMs?: number;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  nominal: { id: 'nominal', label: 'Nominal' },
  caution: { id: 'caution', label: 'Elevated heart rate', targets: { heartRate: 113 } },
  warning: { id: 'warning', label: 'Falling oxygen', targets: { spo2: 90, heartRate: 124 } },
  critical: { id: 'critical', label: 'Hypoxia', targets: { spo2: 85, heartRate: 156 } },
  fever: { id: 'fever', label: 'Fever', targets: { bodyTemp: 38.5, heartRate: 104 } },
  lowGlucose: { id: 'lowGlucose', label: 'Low glucose', targets: { glucose: 58 } },
  nodata: { id: 'nodata', label: 'Sensor offline', disconnect: true },
  coldHand: { id: 'coldHand', label: 'Cold left hand', targets: { fingerTempL: 14 }, suit: true },
  shoulderPressure: { id: 'shoulderPressure', label: 'Shoulder pressure point', targets: { shoulderR: 9 }, suit: true },
  helmetCO2: { id: 'helmetCO2', label: 'Helmet CO₂ rising', targets: { helmetCO2: 11, heartRate: 108 }, suit: true },
  helmetWater: { id: 'helmetWater', label: 'Water in helmet', targets: { helmetWater: 140, heartRate: 118 }, suit: true },
  kneePain: { id: 'kneePain', label: 'Knee pain report', report: { jointPain: { value: 4, site: 'rightKnee' } } },
  slowSpo2: { id: 'slowSpo2', label: 'Oxygen slowly dropping', targets: { spo2: 86, heartRate: 112 }, rampMs: 150_000 },
  slowCO2: { id: 'slowCO2', label: 'Helmet CO₂ slowly rising', targets: { helmetCO2: 13 }, rampMs: 150_000, suit: true },
};

const RAMP_MS = 4000;

/** Which scenario an astronaut is currently in, if it matches one exactly. */
export function activeScenario(state: RoomState | null | undefined, id: AstronautId): ScenarioId | undefined {
  if (state?.disconnects?.[id]) return 'nodata';
  const o = state?.overrides?.[id] ?? {};
  const pain = state?.reports?.[id]?.jointPain;
  return (Object.keys(SCENARIOS) as ScenarioId[]).find((sid) => {
    const sc = SCENARIOS[sid];
    if (sc.disconnect) return false;
    const t = sc.targets ?? {};
    if (Object.keys(t).length !== Object.keys(o).length) return false;
    if (!Object.entries(t).every(([k, v]) => o[k as VitalId]?.target === v)) return false;
    const r = sc.report?.jointPain;
    return r ? pain?.site === r.site && pain.value === r.value : !pain;
  });
}

/** Patch that clears an astronaut's previous scenario and starts a new one. `rampMs` overrides the scenario's pace. */
export function scenarioPatch(id: AstronautId, scenario: ScenarioId, now: number, rampMs?: number): Patch {
  const s = SCENARIOS[scenario];
  const patch: Patch = {
    [`overrides/${id}`]: null,
    [`disconnects/${id}`]: null,
    [`acks/${id}`]: null,
    [`claims/${id}`]: null,
    [`symptomChecks/${id}`]: null,
    [`reports/${id}`]: s.report ? { jointPain: { ...s.report.jointPain, at: now } } : null,
  };
  if (s.targets) {
    const overrides: Record<string, unknown> = {};
    for (const [vital, target] of Object.entries(s.targets)) {
      overrides[vital] = { target, startAt: now, rampMs: rampMs ?? s.rampMs ?? RAMP_MS };
    }
    patch[`overrides/${id}`] = overrides;
  }
  if (s.disconnect) patch[`disconnects/${id}`] = { at: now };
  return patch;
}
