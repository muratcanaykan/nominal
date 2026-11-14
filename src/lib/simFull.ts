// Whether the 3D simulation is in full screen. Other 3D views on the page pause meanwhile, so only one renders.

import { useSyncExternalStore } from 'react';

let full = false;
const listeners = new Set<() => void>();

export function setSimFull(value: boolean) {
  if (full === value) return;
  full = value;
  listeners.forEach((l) => l());
}

export function useSimFull(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => full,
  );
}
