// The crew member a browser is acting as (demo role switcher, cabin "I'm responding"). Stored per browser only.

import { CREW_BY_ID, type AstronautId } from '../domain/crew';

const VIEWER_KEY = 'nominal:viewer';

export function readViewer(fallback: AstronautId): AstronautId {
  try {
    const v = localStorage.getItem(VIEWER_KEY);
    if (v && v in CREW_BY_ID) return v as AstronautId;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

export function saveViewer(id: AstronautId) {
  try {
    localStorage.setItem(VIEWER_KEY, id);
  } catch {
    /* storage unavailable */
  }
}
