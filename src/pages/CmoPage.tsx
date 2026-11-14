// Crew Medical Officer view: detailed values, short trends, notifications (level 2+) and a timeline per crew member.
// The demo PIN is shown on screen on purpose: judges cannot log in to anything.

import { useState, type FormEvent } from 'react';
import { CREW, CREW_BY_ID, OSDR_GLUCOSE, PROFILES, type AstronautId } from '../domain/crew';
import { SCENARIOS } from '../domain/scenarios';
import { crewSummary, snapshot, type Snapshot } from '../domain/sim';
import { LEVEL_NAMES, routingFor, VITAL_IDS, VITALS, type VitalId } from '../domain/vitals';
import type { RoomState } from '../domain/room';
import { formatAgo, formatDelay, levelClass, ShortLabel } from '../components/bits';
import { useNow, useRoom } from '../lib/useRoom';
import { DONKI_LABELS, formatDay, radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';

const DEMO_PIN = '2468';
const UNLOCK_KEY = 'nominal:cmo';
const TREND_MS = 5 * 60 * 1000;

function Sparkline({ state, id, vital, now }: { state: RoomState | undefined; id: AstronautId; vital: VitalId; now: number }) {
  const n = 60;
  const points: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = now - TREND_MS + (i * TREND_MS) / (n - 1);
    const s = snapshot(state, id, t);
    points.push(s.readings[vital].value);
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

interface TimelineItem {
  at: number;
  text: string;
  level?: string;
}

function timeline(state: RoomState | undefined, id: AstronautId): TimelineItem[] {
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
    items.push({ at, text: `Acknowledged ${VITALS[vital as VitalId]?.label.toLowerCase() ?? vital} (${LEVEL_NAMES[Number(level) as 0]})` });
  }
  const mood = state.moods?.[id];
  if (mood) items.push({ at: mood.at, text: `Mood check-in: ${mood.value}/5`, level: mood.value <= 2 ? 'lvl-1' : undefined });
  const g = state.glucoseChecks?.[id];
  if (g) items.push({ at: g.at, text: `Fingerstick glucose: ${g.value} mg/dL` });
  return items.sort((a, b) => b.at - a.at);
}

function CrewCard({ s, state, now }: { s: Snapshot; state: RoomState | undefined; now: number }) {
  const a = CREW_BY_ID[s.astronautId];
  const items = timeline(state, a.id).slice(0, 5);
  return (
    <article className={`cmo-card ${levelClass(s.status)}`}>
      <header className="cmo-card__head">
        <div>
          <h3>{a.name}</h3>
          <span>
            {a.role} · {a.location}
          </span>
        </div>
        <span className={`cmo-badge ${levelClass(s.status)}`}>
          {s.status === 'nodata' ? `No data · ${formatAgo(now - s.readingsAt)}` : LEVEL_NAMES[s.worst]}
        </span>
      </header>
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
              {(v === 'heartRate' || v === 'spo2' || v === 'bodyTemp' || v === 'bloodPressure') && (
                <Sparkline state={state} id={a.id} vital={v} now={now} />
              )}
            </div>
          );
        })}
      </div>
      <p className="cmo-ref">
        Glucose baseline from real data: anonymised Inspiration4 crew member {a.osdrSubject}, pre-flight fasting mean{' '}
        {Math.round(OSDR_GLUCOSE.subjects[a.osdrSubject].preflightMean)} mg/dL, {OSDR_GLUCOSE.subjects[a.osdrSubject].dayAfterLanding} mg/dL
        the day after landing (NASA OSDR {OSDR_GLUCOSE.accession}).
      </p>
      {items.length > 0 && (
        <ol className="cmo-timeline">
          {items.map((it, i) => (
            <li key={i} className={it.level}>
              <time>{formatAgo(now - it.at)} ago</time>
              <span>{it.text}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function SpaceWeatherPanel({ state, now }: { state: RoomState | undefined; now: number }) {
  const weather = useSpaceWeather();
  const advisory = radiationAdvisory(state, weather, now);
  const recent = [...(weather?.notifications ?? [])]
    .filter((n) => n.type !== 'Report')
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, 6);
  return (
    <section className="panel">
      <h2 className="panel__title">Space weather · NASA DONKI</h2>
      <p className={`wx-status${advisory ? ' is-advisory' : ''}`}>
        {advisory
          ? advisory.source === 'simulated'
            ? 'Radiation advisory: simulated solar particle event. Spacewalk crew return to the vehicle; all crew move to the most shielded area.'
            : 'Radiation advisory: NASA DONKI reports a solar particle event in the last 72 hours.'
          : 'No solar particle event in the last 72 hours. No radiation advisory.'}
      </p>
      {weather ? (
        recent.length > 0 ? (
          <ul className="wx-list">
            {recent.map((n) => (
              <li key={n.id}>
                <div className="wx-list__head">
                  <strong>{DONKI_LABELS[n.type] ?? n.type}</strong>
                  <time>{formatDay(n.time)}</time>
                </div>
                <p>{n.summary}</p>
                <a href={n.url} target="_blank" rel="noopener">
                  DONKI record
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cmo-empty">No space weather events in the last 30 days.</p>
        )
      ) : (
        <p className="cmo-empty">Loading space weather…</p>
      )}
      {weather && (
        <p className="panel__hint">
          Source: NASA DONKI via api.nasa.gov · updated {formatDay(weather.fetchedAt)}
          {weather.live ? '' : ' (saved snapshot)'}
        </p>
      )}
    </section>
  );
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (pin === DEMO_PIN) {
      try {
        sessionStorage.setItem(UNLOCK_KEY, '1');
      } catch {
        /* storage unavailable */
      }
      onUnlock();
    } else setWrong(true);
  }
  return (
    <form className="gate pin-gate" onSubmit={submit}>
      <h1>Medical officer access</h1>
      <p>This view shows every crew member's detailed health data, so it is limited to the crew medical officer.</p>
      <p className="pin-gate__demo">
        Demo PIN: <strong>{DEMO_PIN}</strong>
      </p>
      <label htmlFor="cmo-pin">PIN</label>
      <input
        id="cmo-pin"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ''));
          setWrong(false);
        }}
      />
      {wrong && <p className="pin-gate__error">That PIN is not correct. Use the demo PIN shown above.</p>}
      <button className="btn-primary" type="submit">
        Open medical view
      </button>
    </form>
  );
}

function readUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function CmoPage() {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const { state } = useRoom();
  const now = useNow(1000);
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  const st = state ?? undefined;
  const summary = crewSummary(st, now);
  const cmo = CREW.find((c) => c.cmo);
  const profile = PROFILES[st?.profile ?? 'lunar'];
  const notifications = CREW.flatMap((a) => {
    const s = summary.snapshots[a.id];
    const out: { id: AstronautId; text: string; level: string }[] = [];
    if (!s.connected) out.push({ id: a.id, text: 'No sensor data', level: 'lvl-nodata' });
    for (const v of VITAL_IDS) {
      const r = s.readings[v];
      if (s.connected && routingFor(r.level).cmo) {
        out.push({
          id: a.id,
          text: `${VITALS[v].label} ${v === 'bloodPressure' ? `${r.value}/${r.secondary}` : r.value.toFixed(VITALS[v].decimals)} ${VITALS[v].unit} · ${LEVEL_NAMES[r.level]}`,
          level: levelClass(r.level),
        });
      }
    }
    if (st?.help?.[a.id]) out.push({ id: a.id, text: 'Help requested', level: 'lvl-3' });
    return out;
  });

  return (
    <main className="cmo">
      <header className="cmo__head">
        <div>
          <p className="hub__eyebrow">Nominal · Medical officer</p>
          <h1 className="hub__title">{cmo?.name ?? 'Medical officer'}</h1>
        </div>
        <div className="cmo__meta">
          <span>
            {summary.connected}/{summary.total} devices connected
          </span>
          <span>
            {profile.label} · Earth link {formatDelay(profile.earthDelayMs)}
          </span>
        </div>
      </header>

      <section className="panel">
        <h2 className="panel__title">Notifications</h2>
        <p className="panel__hint">You receive warning (level 2) and critical (level 3) alerts. Critical alerts also go to the whole crew and to flight surgeons on Earth.</p>
        {notifications.length === 0 ? (
          <p className="cmo-empty">No notifications for the medical officer.</p>
        ) : (
          <ul className="cmo-notes">
            {notifications.map((n, i) => (
              <li key={i} className={n.level}>
                <strong>{CREW_BY_ID[n.id].name}</strong>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SpaceWeatherPanel state={st} now={now} />

      <section className="cmo-grid" aria-label="Crew details">
        {CREW.map((a) => (
          <CrewCard key={a.id} s={summary.snapshots[a.id]} state={st} now={now} />
        ))}
      </section>
      <p className="cmo__foot">Trends show the last 5 minutes. The shaded band is the nominal range. Simulated data.</p>
    </main>
  );
}
