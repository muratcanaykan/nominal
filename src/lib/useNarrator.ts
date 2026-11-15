// Watches the room and produces narrator beats. A crew member's change is narrated once it has held for a moment, so
// a fast ramp through several levels tells the end result instead of every step on the way.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CREW, type AstronautId } from '../domain/crew';
import { forecast } from '../domain/forecast';
import { countdown, earthMessages, replyAt } from '../domain/earth';
import { forecastBeat, forecastKey, messageBeat, personBeats, personView, replyBeat, solarBeat, viewKey, type Beat, type PersonView } from '../domain/narrator';
import { crewSummary } from '../domain/sim';
import { radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';
import { useRoom, useStore } from './useRoom';
import { formatDelay } from '../components/bits';

export interface NarratedBeat extends Beat {
  key: number;
  shownAt: number;
}

const TICK_MS = 500;
const SETTLE_MS = 1500;
const SHOW_MS = 12_000;
const MAX_SHOWN = 3;

export function useNarrator(show: boolean) {
  const store = useStore();
  const { state } = useRoom();
  const weather = useSpaceWeather();
  const live = useRef({ state, weather, show });
  live.current = { state, weather, show };
  const [beats, setBeats] = useState<NarratedBeat[]>([]);

  useEffect(() => {
    const committed = new Map<AstronautId, PersonView>();
    const pending = new Map<AstronautId, { key: string; since: number }>();
    const seen = new Map<AstronautId, Set<string>>();
    let solar: boolean | null = null;
    let sentSeen: Set<string> | null = null;
    let repliesSeen: Set<string> | null = null;
    let next = 1;

    const tick = () => {
      const { state: raw, weather: w, show: visible } = live.current;
      if (!raw) return;
      const state = raw;
      const now = store.now();
      const summary = crewSummary(state, now);
      const out: Beat[] = [];
      for (const a of CREW) {
        const s = summary.snapshots[a.id];
        const v = personView(state, a.id, s, now, summary.alerts.find((x) => x.astronautId === a.id));
        const prev = committed.get(a.id);
        const fc = forecast(state, a.id, now);
        if (!prev) {
          committed.set(a.id, v);
          seen.set(a.id, new Set(fc ? [forecastKey(fc)] : []));
          continue;
        }
        const k = viewKey(v);
        if (k === viewKey(prev)) pending.delete(a.id);
        else {
          const p = pending.get(a.id);
          if (!p || p.key !== k) pending.set(a.id, { key: k, since: now });
          else if (now - p.since >= SETTLE_MS) {
            out.push(...personBeats(prev, v, a.id, s, state));
            committed.set(a.id, v);
            pending.delete(a.id);
            if (v.status === 0 || v.status === 'nodata') seen.get(a.id)!.clear();
          }
        }
        if (fc && v.status !== 'nodata' && fc.level > v.status) {
          const key = forecastKey(fc);
          const done = seen.get(a.id)!;
          if (!done.has(key)) {
            done.add(key);
            out.push(forecastBeat(a.id, fc));
          }
        }
      }
      const msgs = earthMessages(state);
      if (!sentSeen || !repliesSeen) {
        sentSeen = new Set(msgs.map((m) => m.id));
        repliesSeen = new Set(msgs.filter((m) => now >= replyAt(m)).map((m) => m.id));
      } else {
        for (const m of msgs) {
          if (!sentSeen.has(m.id)) {
            sentSeen.add(m.id);
            out.push(messageBeat(m, formatDelay(m.delayMs), countdown(replyAt(m) - m.at)));
          }
          if (now >= replyAt(m) && !repliesSeen.has(m.id)) {
            repliesSeen.add(m.id);
            out.push(replyBeat(m));
          }
        }
      }

      const sep = !!radiationAdvisory(state, w, now);
      if (solar === null) solar = sep;
      else if (sep !== solar) {
        solar = sep;
        out.push(solarBeat(sep));
      }

      const wall = Date.now();
      setBeats((cur) => {
        let list = cur.filter((b) => wall - b.shownAt < SHOW_MS);
        if (out.length && visible) list = [...list, ...out.map((b) => ({ ...b, key: next++, shownAt: wall }))].slice(-MAX_SHOWN);
        return list.length === cur.length && list.every((b, i) => b === cur[i]) ? cur : list;
      });
    };

    tick();
    const t = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(t);
  }, [store]);

  useEffect(() => {
    if (!show) setBeats([]);
  }, [show]);

  const dismiss = useCallback((key: number) => setBeats((cur) => cur.filter((b) => b.key !== key)), []);
  return { beats: show ? beats : [], dismiss };
}
