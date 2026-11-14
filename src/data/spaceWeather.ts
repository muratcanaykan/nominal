// Space weather from NASA DONKI (via api.nasa.gov).
// A snapshot is fetched at build time (scripts/fetch-donki.mjs → /data/donki.json); the browser then tries to refresh
// it live, so the demo shows current events even weeks after the last deploy.

import { useEffect, useState } from 'react';
import type { RoomState } from '../domain/room';

export interface DonkiNote {
  type: string;
  id: string;
  time: string;
  url: string;
  summary: string;
}

export interface DonkiSep {
  id: string;
  time: string;
  url: string;
}

export interface SpaceWeather {
  source: string;
  fetchedAt: string;
  notifications: DonkiNote[];
  sep: DonkiSep[];
  live?: boolean;
}

export const DONKI_LABELS: Record<string, string> = {
  FLR: 'Solar flare',
  SEP: 'Solar energetic particles',
  CME: 'Coronal mass ejection',
  IPS: 'Interplanetary shock',
  MPC: 'Magnetopause crossing',
  GST: 'Geomagnetic storm',
  RBE: 'Radiation belt enhancement',
  Report: 'Weekly space weather report',
};

const DAY = 24 * 3600 * 1000;
const CACHE_KEY = 'nominal:donki';
const CACHE_MS = 30 * 60 * 1000;
/** A solar particle event keeps the advisory active this long. */
const SEP_ACTIVE_MS = 72 * 3600 * 1000;

function summary(body = ''): string {
  const m = body.match(/## Summary:\s*([\s\S]*?)(?:\n## |$)/);
  const text = (m ? m[1] : body).replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

async function fetchLive(): Promise<SpaceWeather> {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * DAY);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const get = async (path: string) => {
    const res = await fetch(`https://api.nasa.gov/DONKI/${path}&api_key=DEMO_KEY`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  const [notes, sep] = await Promise.all([
    get(`notifications?startDate=${day(start)}&endDate=${day(end)}&type=all`),
    get(`SEP?startDate=${day(start)}&endDate=${day(end)}`),
  ]);
  return {
    source: 'NASA DONKI (api.nasa.gov)',
    fetchedAt: end.toISOString(),
    live: true,
    notifications: (notes ?? []).map((n: Record<string, string>) => ({
      type: n.messageType,
      id: n.messageID,
      time: n.messageIssueTime,
      url: n.messageURL,
      summary: summary(n.messageBody),
    })),
    sep: (sep ?? []).map((s: Record<string, string>) => ({ id: s.sepID, time: s.eventTime, url: s.link })),
  };
}

let pending: Promise<SpaceWeather | null> | null = null;

export function loadSpaceWeather(): Promise<SpaceWeather | null> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as SpaceWeather | null;
      if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_MS) return cached;
    } catch {
      /* storage unavailable */
    }
    let snapshot: SpaceWeather | null = null;
    try {
      snapshot = (await (await fetch('/data/donki.json')).json()) as SpaceWeather;
    } catch {
      /* no snapshot */
    }
    try {
      const live = await fetchLive();
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(live));
      } catch {
        /* storage unavailable */
      }
      return live;
    } catch {
      return snapshot;
    }
  })();
  return pending;
}

export function useSpaceWeather(): SpaceWeather | null {
  const [data, setData] = useState<SpaceWeather | null>(null);
  useEffect(() => {
    let alive = true;
    loadSpaceWeather().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

export interface Advisory {
  source: 'donki' | 'simulated';
  since: number;
  url?: string;
}

/** Radiation advisory: a real solar particle event in the last 72 h, or one simulated from the control panel. */
export function radiationAdvisory(state: RoomState | null | undefined, weather: SpaceWeather | null, now: number): Advisory | null {
  const sim = state?.spaceWeather?.sepAt;
  if (sim && sim <= now) return { source: 'simulated', since: sim };
  const events = [
    ...(weather?.sep ?? []).map((s) => ({ t: Date.parse(s.time), url: s.url })),
    ...(weather?.notifications ?? []).filter((n) => n.type === 'SEP').map((n) => ({ t: Date.parse(n.time), url: n.url })),
  ].filter((e) => !Number.isNaN(e.t) && now - e.t < SEP_ACTIVE_MS && e.t <= now);
  if (!events.length) return null;
  const latest = events.sort((a, b) => b.t - a.t)[0];
  return { source: 'donki', since: latest.t, url: latest.url };
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}
