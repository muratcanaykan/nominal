import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { RoomStore } from './store';

export const RoomContext = createContext<RoomStore | null>(null);

export function useStore(): RoomStore {
  const store = useContext(RoomContext);
  if (!store) throw new Error('useStore must be used inside a RoomContext provider');
  return store;
}

export function useRoom() {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Re-renders on an interval and returns the shared clock. */
export function useNow(intervalMs = 250): number {
  const store = useStore();
  const [now, setNow] = useState(() => store.now());
  useEffect(() => {
    const t = setInterval(() => setNow(store.now()), intervalMs);
    return () => clearInterval(t);
  }, [store, intervalMs]);
  return now;
}
