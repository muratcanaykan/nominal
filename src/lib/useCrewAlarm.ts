// Page-level alarm for alerts that need the crew (level 3 or a help call): a red glow around the screen and, when sound
// is on, an alert tone each time a new one starts.

import { useEffect, useRef } from 'react';
import { crewSummary } from '../domain/sim';
import { armAlarm, playAlarm } from './alarm';
import { useRoom } from './useRoom';

export type AlarmState = 'active' | 'claimed' | null;

export function useCrewAlarm(now: number, sound: boolean): AlarmState {
  const { state } = useRoom();
  const alerts = crewSummary(state ?? undefined, now).alerts;
  const keys = alerts.map((a) => `${a.astronautId}-${a.kind}`).join('|');
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => armAlarm(), []);

  useEffect(() => {
    const current = new Set(keys ? keys.split('|') : []);
    const before = seen.current;
    seen.current = current;
    // Alerts already on screen when the page opens do not sound.
    if (!before || !sound) return;
    if ([...current].some((k) => !before.has(k))) playAlarm();
  }, [keys, sound]);

  if (!alerts.length) return null;
  return alerts.every((a) => a.claimedBy) ? 'claimed' : 'active';
}
