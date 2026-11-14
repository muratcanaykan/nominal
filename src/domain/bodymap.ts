// Groups a crew member's readings by body region for the body map.

import { PAIN_SITES, type BodyRegion } from './body';
import type { AstronautId } from './crew';
import type { RoomState } from './room';
import type { Reading, Snapshot } from './sim';
import { VITALS, type Level } from './vitals';

/** Where a reading shows on the body map. Joint pain uses the joint the crew member reported. */
export function regionOf(r: Reading, state: RoomState | null | undefined, id: AstronautId): BodyRegion | null {
  if (r.id === 'jointPain') {
    const site = state?.reports?.[id]?.jointPain?.site;
    return site && r.value > 0 ? PAIN_SITES[site].region : null;
  }
  return VITALS[r.id].region;
}

export interface RegionState {
  level: Level;
  readings: Reading[];
}

export function regionStates(s: Snapshot, state: RoomState | null | undefined): Partial<Record<BodyRegion, RegionState>> {
  const out: Partial<Record<BodyRegion, RegionState>> = {};
  if (!s.connected) return out;
  for (const r of Object.values(s.readings)) {
    if (r.inactive) continue;
    const region = regionOf(r, state, s.astronautId);
    if (!region) continue;
    const cur = (out[region] ??= { level: 0, readings: [] });
    cur.readings.push(r);
    if (r.level > cur.level) cur.level = r.level;
  }
  return out;
}
