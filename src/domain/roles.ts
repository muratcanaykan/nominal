// Who may see what. Watches and tablets are personal. The commander sees each crew member's duty status but never a
// health value or its reason; the crew medical officer sees every detail.

import { CREW_BY_ID, type AstronautId } from './crew';
import type { RoomState } from './room';
import type { Snapshot } from './sim';

export type DutyStatus = 'clear' | 'medical' | 'critical' | 'help' | 'nodata';

export const DUTY_LABELS: Record<DutyStatus, string> = {
  clear: 'No active alerts',
  medical: 'Medical review',
  critical: 'Critical',
  help: 'Help requested',
  nodata: 'No data',
};

export const DUTY_HINTS: Record<DutyStatus, string> = {
  clear: 'Available for tasks.',
  medical: 'The medical officer is following up. Ask before assigning demanding tasks.',
  critical: 'Shown on the cabin screen. The crew is responding.',
  help: 'Shown on the cabin screen. The crew is responding.',
  nodata: 'The watch is not sending data. Check in with the crew member.',
};

/**
 * The commander's view of one crew member. A caution (level 1) stays private to the astronaut; a warning (level 2)
 * only says that the medical officer is involved.
 */
export function dutyStatus(s: Snapshot, state: RoomState | undefined, now: number): DutyStatus {
  const help = state?.help?.[s.astronautId];
  if (help && help.at <= now) return 'help';
  if (!s.connected) return 'nodata';
  if (s.worst === 3) return 'critical';
  if (s.worst === 2) return 'medical';
  return 'clear';
}

export type TabletView = 'self' | 'crewMedical';

export const TABLET_VIEW_LABELS: Record<TabletView, string> = {
  self: 'My health',
  crewMedical: 'Crew medical',
};

/** The views a crew member's tablet offers. Only the medical officer's tablet has a second view. */
export function tabletViews(id: AstronautId): TabletView[] {
  return CREW_BY_ID[id].cmo ? ['self', 'crewMedical'] : ['self'];
}

/** The commander sees the crew duty status next to their own health, on the same screen. */
export const seesCrewStatus = (id: AstronautId) => !!CREW_BY_ID[id].commander;

/** Plain-language list of what a crew member can see, for the demo's role switcher. */
export function canSee(id: AstronautId): string[] {
  const a = CREW_BY_ID[id];
  const items = ['Own watch: readings, alerts and what to do', 'Own tablet: detailed readings, trends and history', 'Cabin screen: alerts that need the crew'];
  if (a.commander) items.push('Crew status: who has an active alert, without health values');
  if (a.cmo) items.push("Crew medical: every crew member's detailed data (PIN)");
  return items;
}
