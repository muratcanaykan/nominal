// Pulling a crew member back in by the safety tether. Spacewalkers stay clipped to a tether line at the hatch; in this
// prototype a powered reel there can pull them back to the airlock. Only in a crew emergency (a critical alert or a
// help call) during a spacewalk, and only by the commander or the medical officer, never by the person themselves.

import { CREW_BY_ID, type AstronautId } from './crew';
import { isEva } from './locations';
import type { RoomState } from './room';
import { snapshot } from './sim';

/** How long the pull from the work site to the airlock takes in the demo. */
export const PULL_MS = 12_000;

/** A crew emergency that the cabin screen shows: a help call or a critical alert with live data. */
export function inEmergency(state: RoomState | null | undefined, id: AstronautId, now: number): boolean {
  const help = state?.help?.[id];
  if (help && help.at <= now) return true;
  const s = snapshot(state ?? undefined, id, now);
  return s.connected && s.worst === 3;
}

/** Only the commander and the medical officer may pull someone in. */
export const mayPull = (by: AstronautId) => !!(CREW_BY_ID[by].commander || CREW_BY_ID[by].cmo);

/** Whether `by` can pull `id` in right now. */
export function canPull(state: RoomState | null | undefined, id: AstronautId, by: AstronautId, now: number): boolean {
  return by !== id && mayPull(by) && isEva(state, id) && inEmergency(state, id, now);
}

export interface PullStatus {
  by: AstronautId;
  at: number;
  /** Still on the way to the airlock. */
  active: boolean;
  /** Milliseconds until the crew member reaches the airlock (0 once there). */
  left: number;
}

export function pullOf(state: RoomState | null | undefined, id: AstronautId, now: number): PullStatus | null {
  const p = state?.pulls?.[id];
  if (!p) return null;
  const left = Math.max(0, p.at + PULL_MS - now);
  return { by: p.by, at: p.at, active: left > 0, left };
}
