// "Open on my tablet" from the cabin screen: asks the page's tablet to show a crew member (own health, or the crew
// medical view for the medical officer). Health values never appear on the shared cabin screen itself.

import { useSyncExternalStore } from 'react';
import type { AstronautId } from '../domain/crew';

export interface TabletRequest {
  target: AstronautId;
  at: number;
}

let request: TabletRequest | null = null;
const listeners = new Set<() => void>();

export function requestTablet(target: AstronautId) {
  request = { target, at: Date.now() };
  listeners.forEach((l) => l());
}

export function useTabletRequest(): TabletRequest | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => request,
  );
}
