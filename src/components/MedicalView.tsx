// Crew medical view on the medical officer's tablet: notifications (level 2+), space weather, and every crew member's
// detailed values, trends and timeline. The demo PIN is shown on screen on purpose: judges cannot log in to anything.

import { useEffect, useState, type FormEvent } from 'react';
import { CREW, CREW_BY_ID, MISSION_DAY_OFFSET_MS, OSDR_GLUCOSE, PROFILES, type AstronautId } from '../domain/crew';
import { locationLabel } from '../domain/locations';
import type { RoomState } from '../domain/room';
import { forecast, forecastText } from '../domain/forecast';
import { crewSummary, MOOD_MISSED_MS, moodPromptStart, type CrewAlert, type Snapshot } from '../domain/sim';
import { checklistProgress } from '../domain/response';
import { LEVEL_NAMES, routingFor, VITAL_IDS, VITALS } from '../domain/vitals';
import { DONKI_LABELS, formatDay, radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';
import { formatAgo, formatDelay, LevelMark, levelClass } from './bits';
import { Avatar } from './Avatar';
import { BodyMap } from './BodyMap';
import { RadiationLine } from './Radiation';
import { EarthPanel } from './EarthLink';
import { LabPanel } from './LabPanel';
import { readingNote, readingValue, Timeline, timeline, VitalTiles } from './health';

export const DEMO_PIN = '2468';
const UNLOCK_KEY = 'nominal:cmo';

/** Remembers for this browser session that the demo PIN was entered. */
export function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function readUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (pin === DEMO_PIN) {
      markUnlocked();
      onUnlock();
    } else setWrong(true);
  }
  return (
    <form className="pin-gate" onSubmit={submit}>
      <h2>Medical officer access</h2>
      <p>This view shows every crew member's detailed health data, so it opens only on the medical officer's tablet.</p>
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
        Open crew medical
      </button>
    </form>
  );
}

/** Crew alert progress on the cabin screen: who is responding and how many checklist steps are done. */
function ResponseLine({ alert, state }: { alert: CrewAlert; state: RoomState | undefined }) {
  const p = checklistProgress(alert, state);
  const by = alert.claimedBy ? CREW_BY_ID[alert.claimedBy].name : null;
  return (
    <p className="cmo-response">
      <strong>
        Response {p.done}/{p.total}
      </strong>{' '}
      · {by ? `${by} is responding` : 'Nobody has answered yet on the cabin screen'}
    </p>
  );
}

function CrewCard({
  s,
  state,
  now,
  focused,
  alert,
}: {
  s: Snapshot;
  state: RoomState | undefined;
  now: number;
  focused?: boolean;
  alert?: CrewAlert;
}) {
  const a = CREW_BY_ID[s.astronautId];
  const subject = OSDR_GLUCOSE.subjects[a.osdrSubject];
  return (
    <article id={`cmo-card-${a.id}`} className={`cmo-card ${levelClass(s.status)}${focused ? ' is-focus' : ''}`}>
      <header className="cmo-card__head">
        <Avatar id={a.id} size={34} />
        <div className="cmo-card__who">
          <h3>{a.name}</h3>
          <span>
            {a.role} · {locationLabel(state, a.id)}
          </span>
        </div>
        <span className={`cmo-badge ${levelClass(s.status)}`}>
          <LevelMark status={s.status} /> {s.status === 'nodata' ? `No data · ${formatAgo(now - s.readingsAt)}` : LEVEL_NAMES[s.worst]}
        </span>
      </header>
      {alert && <ResponseLine alert={alert} state={state} />}
      <div className="cmo-card__body">
        <BodyMap s={s} state={state} compact />
        <VitalTiles s={s} state={state} now={now} />
      </div>
      <RadiationLine id={a.id} state={state} now={now} />
      <p className="cmo-ref">
        Glucose baseline from real data: anonymised commercial spaceflight crew member {a.osdrSubject}, pre-flight fasting mean{' '}
        {Math.round(subject.preflightMean)} mg/dL, {subject.dayAfterLanding} mg/dL the day after landing (NASA OSDR{' '}
        {OSDR_GLUCOSE.accession}).
      </p>
      <LabPanel subject={a.osdrSubject} />
      <Timeline items={timeline(state, a.id).slice(0, 5)} now={now} />
    </article>
  );
}

export function SpaceWeatherPanel({ state, now }: { state: RoomState | undefined; now: number }) {
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
          Source: NASA DONKI (CCMC DONKI API) · updated {formatDay(weather.fetchedAt)}
          {weather.live ? '' : ' (saved snapshot)'}
        </p>
      )}
    </section>
  );
}

/** Everything the medical officer sees about the crew, after the PIN. `focus` scrolls to and highlights one card. */
export function MedicalOverview({
  state,
  now,
  focus,
}: {
  state: RoomState | undefined;
  now: number;
  focus?: { id: AstronautId; at: number } | null;
}) {
  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => document.getElementById(`cmo-card-${focus.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450);
    return () => window.clearTimeout(t);
  }, [focus]);
  const summary = crewSummary(state, now);
  const profile = PROFILES[state?.profile ?? 'lunar'];
  const notifications = CREW.flatMap((a) => {
    const s = summary.snapshots[a.id];
    const out: { id: AstronautId; text: string; level: string }[] = [];
    if (!s.connected) out.push({ id: a.id, text: 'No sensor data', level: 'lvl-nodata' });
    for (const v of VITAL_IDS) {
      const r = s.readings[v];
      if (s.connected && routingFor(r.level).cmo) {
        const note = readingNote(r, state, a.id);
        out.push({
          id: a.id,
          text: `${VITALS[v].label} ${readingValue(r)} ${VITALS[v].unit}${note ? ` (${note})` : ''} · ${LEVEL_NAMES[r.level]}`,
          level: levelClass(r.level),
        });
      }
    }
    if (state?.help?.[a.id]) out.push({ id: a.id, text: 'Help requested', level: 'lvl-3' });
    // Heads-up when a reading is heading for warning or critical.
    const fc = s.connected ? forecast(state, a.id, now) : null;
    if (fc && fc.level >= 2) out.push({ id: a.id, text: `Early warning: ${forecastText(fc)}`, level: levelClass(fc.level) });
    const moodSince = moodPromptStart(state, a.id, now, MISSION_DAY_OFFSET_MS);
    if (s.connected && moodSince !== null && now - moodSince >= MOOD_MISSED_MS) {
      out.push({ id: a.id, text: `Mood check-in not answered (${formatAgo(now - moodSince)})`, level: 'lvl-1' });
    }
    return out;
  });

  return (
    <div className="medical">
      <section className="panel">
        <div className="medical__meta">
          <h2 className="panel__title">Notifications</h2>
          <span>
            {summary.connected}/{summary.total} devices connected · {profile.label} · Earth link {formatDelay(profile.earthDelayMs)}
          </span>
        </div>
        <p className="panel__hint">
          You receive warning (level 2) and critical (level 3) alerts. Critical alerts also go to the whole crew and to
          flight surgeons on Earth.
        </p>
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

      <EarthPanel state={state} now={now} from={CREW.find((c) => c.cmo)?.id ?? CREW[0].id} />

      <section className="cmo-grid" aria-label="Crew details">
        {CREW.map((a) => (
          <CrewCard
            key={a.id}
            s={summary.snapshots[a.id]}
            state={state}
            now={now}
            focused={focus?.id === a.id}
            alert={summary.alerts.find((x) => x.astronautId === a.id)}
          />
        ))}
      </section>

      <SpaceWeatherPanel state={state} now={now} />
      <p className="cmo__foot">Trends show the last 5 minutes. The shaded band is the nominal range. Simulated data.</p>
    </div>
  );
}
