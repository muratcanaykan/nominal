// Detailed health building blocks shared by the personal tablet and the medical officer's crew view.

import { PAIN_SITES } from '../domain/body';
import { CREW_BY_ID, type AstronautId } from '../domain/crew';
import type { RoomState } from '../domain/room';
import { SCENARIOS } from '../domain/scenarios';
import { snapshot, type Reading, type Snapshot } from '../domain/sim';
import { LEVEL_NAMES, VITAL_IDS, VITALS, type VitalId } from '../domain/vitals';
import { formatAgo, levelClass, ShortLabel } from './bits';

const TREND_MS = 5 * 60 * 1000;

export function readingValue(r: Reading): string {
  return r.id === 'bloodPressure' ? `${r.value}/${r.secondary}` : r.value.toFixed(VITALS[r.id].decimals);
}

/** Short note on where a value comes from: a sensor waiting for confirmation, a confirmed symptom, a reported joint. */
export function readingNote(r: Reading, state: RoomState | null | undefined, id: AstronautId): string {
  const confirm = VITALS[r.id].confirm;
  if (r.id === 'jointPain') {
    const site = state?.reports?.[id]?.jointPain?.site;
    return site && r.value > 0 ? PAIN_SITES[site].label.toLowerCase() : '';
  }
  if (r.pending) return confirm?.kind === 'fingerstick' ? 'sensor · awaiting fingerstick' : 'sensor · awaiting answer';
  if (r.confirmed) return confirm?.kind === 'symptom' ? confirm.confirmed : 'fingerstick';
  if (r.denied) return 'no symptoms reported';
  return '';
}

/** Readings worth a tile: suit sensors only while suited, joint pain only once reported. */
export const showsTile = (r: Reading) => !r.inactive && !(r.id === 'jointPain' && r.value === 0);
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
      {VITAL_IDS.filter((v) => showsTile(s.readings[v])).map((v) => {
        const r = s.readings[v];
        const def = VITALS[v];
        const note = readingNote(r, state, s.astronautId);
        return (
          <div key={v} className={`cmo-vital ${levelClass(s.connected ? r.level : 'nodata')}${def.suit ? ' cmo-vital--suit' : ''}`}>
            <span className="cmo-vital__label">
              <ShortLabel text={def.short} />
              {def.suit && <span className="cmo-vital__tag">suit</span>}
              {note && <em> {note}</em>}
            </span>
            <span className="cmo-vital__value">
              {readingValue(r)}
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
  for (const [vital, check] of Object.entries(state.symptomChecks?.[id] ?? {})) {
    if (!check) continue;
    const def = VITALS[vital as VitalId];
    const q = def.confirm?.kind === 'symptom' ? def.confirm.question : def.label;
    items.push({ at: check.at, text: `${q} ${check.yes ? 'Yes' : 'No'}`, level: check.yes ? 'lvl-2' : undefined });
  }
  const pain = state.reports?.[id]?.jointPain;
  if (pain) items.push({ at: pain.at, text: `Joint pain reported: ${PAIN_SITES[pain.site].label.toLowerCase()}, ${pain.value}/10`, level: 'lvl-1' });
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
