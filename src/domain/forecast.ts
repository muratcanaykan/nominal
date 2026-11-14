// Early warning: when an indicator drifts steadily away from the crew member's own baseline toward the next alert
// level, estimate how soon it gets there.
// Method: the last 30 seconds of readings (every 2.5 s). The reading must (1) have left the normal noise band around
// the personal baseline, (2) keep moving the same way (at least 80 % of steps) by a meaningful amount, and (3) keep
// moving away from the baseline, and (4) change gradually: no single step may carry most of the change, and the last
// 10 seconds must still move at a similar pace, so a sudden jump that has already stopped is not mistaken for a trend. A straight-line fit then predicts when the next threshold is crossed.
// Prototype logic, not clinically validated.

import type { AstronautId } from './crew';
import { isSuited } from './locations';
import type { RoomState } from './room';
import { centreValue, snapshot, valueAt } from './sim';
import { VITALS, levelFor, type Level, type VitalId } from './vitals';

export interface Forecast {
  vital: VitalId;
  /** The alert level the reading is heading for. */
  level: Level;
  /** Estimated time until it gets there. */
  inMs: number;
  direction: 'up' | 'down';
}

const WINDOW_MS = 30_000;
const STEP_MS = 2_500;
const HORIZON_MS = 5 * 60_000;
/** Samples in the recent part of the window (10 s). */
const RECENT = 5;
/** The recent pace must be at least this share of the whole window's pace. */
const RECENT_SHARE = 0.5;
/** Largest share of the window's change that one step may carry. */
const MAX_STEP_SHARE = 0.3;

/** Normal variation around the personal baseline; a trend only counts once the reading has left this band. */
const NOISE_BAND: Partial<Record<VitalId, number>> = {
  spo2: 1.6,
  heartRate: 14,
  bloodPressure: 8,
  bodyTemp: 0.35,
  glucose: 15,
  helmetCO2: 0.8,
  fingerTempL: 2,
  fingerTempR: 2,
  shoulderL: 1.2,
  shoulderR: 1.2,
};

/** Smallest change over the window that counts as a real trend (above normal sensor noise). */
const MIN_CHANGE: Partial<Record<VitalId, number>> = {
  spo2: 1.5,
  heartRate: 10,
  bloodPressure: 10,
  bodyTemp: 0.3,
  glucose: 15,
  helmetCO2: 1.5,
  fingerTempL: 3,
  fingerTempR: 3,
  shoulderL: 2,
  shoulderR: 2,
};

const VITALS_WITH_TREND = Object.keys(MIN_CHANGE) as VitalId[];

function trend(id: AstronautId, vital: VitalId, now: number, state: RoomState | undefined) {
  const n = WINDOW_MS / STEP_MS + 1;
  const ts: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = now - WINDOW_MS + i * STEP_MS;
    ts.push(t);
    vs.push(valueAt(id, vital, t, state));
  }
  let up = 0;
  let down = 0;
  for (let i = 1; i < n; i++) {
    if (vs[i] > vs[i - 1]) up++;
    else if (vs[i] < vs[i - 1]) down++;
  }
  const steady = Math.max(up, down) / (n - 1) >= 0.8;
  const change = vs[n - 1] - vs[0];
  if (!steady || Math.abs(change) < (MIN_CHANGE[vital] ?? Infinity)) return null;
  for (let i = 1; i < n; i++) if (Math.abs(vs[i] - vs[i - 1]) > Math.abs(change) * MAX_STEP_SHARE) return null;
  const slope = fitSlope(ts, vs);
  const recent = fitSlope(ts.slice(-RECENT), vs.slice(-RECENT));
  if (Math.sign(recent) !== Math.sign(slope) || Math.abs(recent) < Math.abs(slope) * RECENT_SHARE) return null;
  return { slope, value: vs[n - 1] };
}

/** Least-squares slope (value per millisecond). */
function fitSlope(ts: number[], vs: number[]): number {
  const n = ts.length;
  const mt = ts.reduce((a, b) => a + b, 0) / n;
  const mv = vs.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (ts[i] - mt) * (vs[i] - mv);
    den += (ts[i] - mt) ** 2;
  }
  return num / den;
}

/** The soonest predicted escalation for a crew member, or null when nothing is heading for a worse level. */
export function forecast(state: RoomState | undefined, id: AstronautId, now: number): Forecast | null {
  const snap = snapshot(state, id, now);
  if (!snap.connected) return null;
  const suited = isSuited(state, id);
  let best: Forecast | null = null;
  for (const vital of VITALS_WITH_TREND) {
    const def = VITALS[vital];
    if (def.suit && !suited) continue;
    const tr = trend(id, vital, now, state);
    if (!tr || tr.slope === 0) continue;
    const away = tr.value - centreValue(id, vital);
    if (Math.abs(away) < (NOISE_BAND[vital] ?? 0) || Math.sign(away) !== Math.sign(tr.slope)) continue;
    const current = levelFor(vital, tr.value);
    if (current >= def.maxLevel) continue;
    const ranges = [def.thresholds.nominal, def.thresholds.caution, def.thresholds.warning];
    const [lo, hi] = ranges[current];
    const bound = tr.slope > 0 ? hi : lo;
    const inMs = (bound - tr.value) / tr.slope;
    if (!(inMs > 0 && inMs <= HORIZON_MS)) continue;
    const candidate: Forecast = { vital, level: (current + 1) as Level, inMs, direction: tr.slope > 0 ? 'up' : 'down' };
    if (!best || candidate.level > best.level || (candidate.level === best.level && candidate.inMs < best.inMs)) best = candidate;
  }
  return best;
}

/** "about 1 min 40 s" style text for a forecast. */
export function formatEta(ms: number): string {
  const s = Math.max(5, Math.round(ms / 5000) * 5);
  if (s < 60) return `about ${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `about ${m} min ${r} s` : `about ${m} min`;
}

/** "Blood oxygen falling · Warning in about 1 min" */
export function forecastText(f: Forecast): string {
  const names = ['Nominal', 'Caution', 'Warning', 'Critical'];
  return `${VITALS[f.vital].label} ${f.direction === 'down' ? 'falling' : 'rising'} · ${names[f.level]} in ${formatEta(f.inMs)}`;
}
