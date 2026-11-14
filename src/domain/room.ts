// Shared state of one demo session ("room"). Stored in Firebase under rooms/{ROOMID};
// only user actions and scenario events live here. Indicator values are computed from time (see sim.ts).

import type { PainSite } from './body';
import type { AstronautId, ProfileId } from './crew';
import type { LocationId } from './locations';
import type { Level, VitalId } from './vitals';

export interface Override {
  /** Value the indicator moves toward. */
  target: number;
  startAt: number;
  rampMs: number;
}

export interface RoomState {
  createdAt: number;
  profile: ProfileId;
  overrides?: Partial<Record<AstronautId, Partial<Record<VitalId, Override>>>>;
  disconnects?: Partial<Record<AstronautId, { at: number }>>;
  help?: Partial<Record<AstronautId, { at: number }>>;
  claims?: Partial<Record<AstronautId, { by: AstronautId; at: number }>>;
  /** Response checklist steps ticked on the cabin screen, keyed by step id. */
  checklists?: Partial<Record<AstronautId, Partial<Record<string, { by: AstronautId; at: number }>>>>;
  /** Acknowledged alerts, keyed `${vital}-${level}`. */
  acks?: Partial<Record<AstronautId, Record<string, number>>>;
  moods?: Partial<Record<AstronautId, { value: number; at: number }>>;
  /** A mood check-in requested from the control panel (scheduled ones are computed from the clock). */
  moodPrompts?: Partial<Record<AstronautId, { at: number }>>;
  /** Fingerstick glucose tests entered on the watch. */
  glucoseChecks?: Partial<Record<AstronautId, { value: number; at: number }>>;
  /** Crew members moved away from their starting location. */
  locations?: Partial<Record<AstronautId, LocationId>>;
  /** Answers to a sensor's symptom question on the watch (e.g. "Do your fingers feel numb?"). */
  symptomChecks?: Partial<Record<AstronautId, Partial<Record<VitalId, { yes: boolean; at: number }>>>>;
  /** Symptoms reported from the watch. */
  reports?: Partial<Record<AstronautId, { jointPain?: { value: number; site: PainSite; at: number } }>>;
  /** Demo trigger for a solar particle event (real events come from NASA DONKI). */
  spaceWeather?: { sepAt?: number };
}

export const ackKey = (vital: VitalId, level: Level) => `${vital}-${level}`;

export function newRoomState(now: number, profile: ProfileId = 'lunar'): RoomState {
  return { createdAt: now, profile };
}

/** A multi-path patch, Firebase `update()` style: keys are slash paths, `null` deletes. */
export type Patch = Record<string, unknown>;

export function applyPatch<T extends object>(state: T, patch: Patch): T {
  const next = structuredClone(state) as Record<string, unknown>;
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split('/').filter(Boolean);
    let node = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof node[key] !== 'object' || node[key] === null) {
        if (value === null) {
          node = undefined as never;
          break;
        }
        node[key] = {};
      }
      node = node[key] as Record<string, unknown>;
    }
    if (!node) continue;
    const last = parts[parts.length - 1];
    if (value === null) delete node[last];
    else node[last] = structuredClone(value);
  }
  return pruneEmpty(next) as T;
}

// Firebase drops empty objects; mirror that so local and remote state look the same.
function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      pruneEmpty(v as Record<string, unknown>);
      if (Object.keys(v).length === 0) delete obj[k];
    }
  }
  return obj;
}
