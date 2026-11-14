// Demo scenarios: one click moves an astronaut's indicators so every screen shows the same story.

import type { AstronautId } from './crew';
import type { Patch, RoomState } from './room';
import type { VitalId } from './vitals';

export type ScenarioId = 'nominal' | 'caution' | 'warning' | 'critical' | 'fever' | 'lowGlucose' | 'nodata';

export interface Scenario {
  id: ScenarioId;
  label: string;
  targets?: Partial<Record<VitalId, number>>;
  disconnect?: boolean;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  nominal: { id: 'nominal', label: 'Nominal' },
  caution: { id: 'caution', label: 'Elevated heart rate', targets: { heartRate: 113 } },
  warning: { id: 'warning', label: 'Falling oxygen', targets: { spo2: 90, heartRate: 124 } },
  critical: { id: 'critical', label: 'Hypoxia', targets: { spo2: 85, heartRate: 156 } },
  fever: { id: 'fever', label: 'Fever', targets: { bodyTemp: 38.5, heartRate: 104 } },
  lowGlucose: { id: 'lowGlucose', label: 'Low glucose', targets: { glucose: 58 } },
  nodata: { id: 'nodata', label: 'Sensor offline', disconnect: true },
};

const RAMP_MS = 4000;

/** Which scenario an astronaut is currently in, if it matches one exactly. */
export function activeScenario(state: RoomState | null | undefined, id: AstronautId): ScenarioId | undefined {
  if (state?.disconnects?.[id]) return 'nodata';
  const o = state?.overrides?.[id];
  if (!o) return 'nominal';
  return (Object.keys(SCENARIOS) as ScenarioId[]).find((sid) => {
    const t = SCENARIOS[sid].targets;
    return (
      t &&
      Object.keys(t).length === Object.keys(o).length &&
      Object.entries(t).every(([k, v]) => o[k as VitalId]?.target === v)
    );
  });
}

/** Patch that clears an astronaut's previous scenario and starts a new one. */
export function scenarioPatch(id: AstronautId, scenario: ScenarioId, now: number): Patch {
  const s = SCENARIOS[scenario];
  const patch: Patch = {
    [`overrides/${id}`]: null,
    [`disconnects/${id}`]: null,
    [`acks/${id}`]: null,
    [`claims/${id}`]: null,
  };
  if (s.targets) {
    const overrides: Record<string, unknown> = {};
    for (const [vital, target] of Object.entries(s.targets)) {
      overrides[vital] = { target, startAt: now, rampMs: RAMP_MS };
    }
    patch[`overrides/${id}`] = overrides;
  }
  if (s.disconnect) patch[`disconnects/${id}`] = { at: now };
  return patch;
}
