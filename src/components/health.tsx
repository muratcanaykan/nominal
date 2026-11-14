// Detailed health building blocks shared by the personal tablet and the medical officer's crew view.

import { CREW_BY_ID, type AstronautId } from '../domain/crew';
import type { RoomState } from '../domain/room';
import { SCENARIOS } from '../domain/scenarios';
import { snapshot, type Snapshot } from '../domain/sim';
import { LEVEL_NAMES, VITAL_IDS, VITALS, type VitalId } from '../domain/vitals';
import { formatAgo, levelClass, ShortLabel } from './bits';

const TREND_MS = 5 * 60 * 1000;
const TREND_VITALS: VitalId[] = ['heartRate', 'spo2', 'bloodPressure', 'bodyTemp', 'glucose'];

export function Sparkline({ state, id, vital, now }: { state: RoomState | undefined; id: AstronautId; vital: VitalId; now: number }) {
  const n = 60;
  const points: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = now - TREND_MS + (i * TREND_MS) / (n - 1);
    points.push(snapshot(state, id, t).readings[vital].value);
  }
  const { nominal } = VITALS[vital].thresholds;
  const lo = Math.min(...points, nominal[0]);
  const hi = Math.max(...points, Math.min(nominal[1], Math.max(...points) + 5));
  const y = (v: number) => 30 - ((v - lo) / Math.max(1e-6, hi - lo)) * 26 - 2;
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (n - 1)) * 120).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const bandTop = y(Math.min(nominal[1], hi));
  const bandBottom = y(Math.max(nominal[0], lo));
  return (
    <svg className="spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y={bandTop} width="120" height={Math.max(0, bandBottom - bandTop)} className="spark__band" />
      <path d={d} className="spark__line" />
    </svg>
  );
}

/** Every indicator of one crew member, with short trends. */
export function VitalTiles({ s, state, now }: { s: Snapshot; state: RoomState | undefined; now: number }) {
  return (
    <div className="cmo-vitals">
      {VITAL_IDS.map((v) => {
        const r = s.readings[v];
        const def = VITALS[v];
        const value = v === 'bloodPressure' ? `${r.value}/${r.secondary}` : r.value.toFixed(def.decimals);
        return (
          <div key={v} className={`cmo-vital ${levelClass(s.connected ? r.level : 'nodata')}`}>
            <span className="cmo-vital__label">
              <ShortLabel text={def.short} />
              {r.pending && <em> sensor · awaiting fingerstick</em>}
              {r.confirmed && <em> fingerstick</em>}
            </span>
            <span className="cmo-vital__value">
              {value}
              <small>{def.unit}</small>
            </span>
            {TREND_VITALS.includes(v) && <Sparkline state={state} id={s.astronautId} vital={v} now={now} />}
          </div>
        );
      })}
    </div>
  );
}

export interface TimelineItem {
  at: number;
  text: string;
  level?: string;
}

export function timeline(state: RoomState | undefined, id: AstronautId): TimelineItem[] {
  if (!state) return [];
  const items: TimelineItem[] = [];
  const overrides = state.overrides?.[id];
  if (overrides) {
    const first = Object.values(overrides)[0];
    const sc = Object.values(SCENARIOS).find(
      (s) => s.targets && Object.entries(s.targets).every(([k, v]) => overrides[k as VitalId]?.target === v),
    );
    if (first) items.push({ at: first.startAt, text: `Readings changing: ${sc?.label.toLowerCase() ?? 'custom'}`, level: 'lvl-1' });
  }
  const off = state.disconnects?.[id];
  if (off) items.push({ at: off.at, text: 'Sensor stopped sending data', level: 'lvl-nodata' });
  const help = state.help?.[id];
  if (help) items.push({ at: help.at, text: 'Help requested from the watch', level: 'lvl-3' });
  const claim = state.claims?.[id];
  if (claim) items.push({ at: claim.at, text: `${CREW_BY_ID[claim.by].name} responded` });
  for (const [key, at] of Object.entries(state.acks?.[id] ?? {})) {
    const [vital, level] = key.split('-');
    const label = vital === 'radiation' ? 'radiation advisory' : (VITALS[vital as VitalId]?.label.toLowerCase() ?? vital);
    items.push({ at, text: `Acknowledged ${label} (${LEVEL_NAMES[Number(level) as 0]})` });
  }
  const mood = state.moods?.[id];
  if (mood) items.push({ at: mood.at, text: `Mood check-in: ${mood.value}/5`, level: mood.value <= 2 ? 'lvl-1' : undefined });
  const g = state.glucoseChecks?.[id];
  if (g) items.push({ at: g.at, text: `Fingerstick glucose: ${g.value} mg/dL` });
  return items.sort((a, b) => b.at - a.at);
}

export function Timeline({ items, now, empty }: { items: TimelineItem[]; now: number; empty?: string }) {
  if (items.length === 0) return empty ? <p className="cmo-empty">{empty}</p> : null;
  return (
    <ol className="cmo-timeline">
      {items.map((it, i) => (
        <li key={i} className={it.level}>
          <time>{formatAgo(now - it.at)} ago</time>
          <span>{it.text}</span>
        </li>
      ))}
    </ol>
  );
}
