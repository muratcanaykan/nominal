// A crew member's personal tablet. Everyone sees their own detailed data. The commander's tablet adds each crew
// member's duty status (no health values); the medical officer's tablet adds the crew medical view behind the demo PIN.

import { memo, useState } from 'react';
import { CREW, CREW_BY_ID, MISSION_DAY_OFFSET_MS, OSDR_GLUCOSE, type AstronautId } from '../domain/crew';
import { DUTY_HINTS, DUTY_LABELS, dutyStatus, seesCrewStatus, TABLET_VIEW_LABELS, tabletViews, type DutyStatus, type TabletView } from '../domain/roles';
import { isEva, locationLabel } from '../domain/locations';
import type { RoomState } from '../domain/room';
import { crewSummary, missionClock, snapshot } from '../domain/sim';
import { LEVEL_NAMES, routingFor, VITALS } from '../domain/vitals';
import { radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';
import { useNow, useRoom } from '../lib/useRoom';
import { formatAgo, levelClass } from './bits';
import { Avatar } from './Avatar';
import { BodyMap } from './BodyMap';
import { readingNote, readingValue, Timeline, timeline, VitalTiles } from './health';
import { MedicalOverview, PinGate, readUnlocked } from './MedicalView';

const DUTY_LEVEL: Record<DutyStatus, string> = {
  clear: 'lvl-0',
  medical: 'lvl-2',
  critical: 'lvl-3',
  help: 'lvl-3',
  nodata: 'lvl-nodata',
};

function whoIsTold(level: 0 | 1 | 2 | 3): string {
  const r = routingFor(level);
  if (r.earth) return 'You, the whole crew on the cabin screen, the medical officer and flight surgeons on Earth';
  if (r.cmo) return 'You and the medical officer';
  return 'Only you';
}

function MyHealth({ id, state, now, titled }: { id: AstronautId; state: RoomState | undefined; now: number; titled?: boolean }) {
  const a = CREW_BY_ID[id];
  const s = snapshot(state, id, now);
  const weather = useSpaceWeather();
  const advisory = radiationAdvisory(state, weather, now);
  const subject = OSDR_GLUCOSE.subjects[a.osdrSubject];
  const top = s.connected ? s.top : undefined;

  let headline = 'No active alerts';
  let action = 'All your readings are in their nominal ranges.';
  if (!s.connected) {
    headline = 'Your watch is not sending data';
    action = `Last update ${formatAgo(now - s.readingsAt)} ago. Check that the watch is on and sits close to your skin.`;
  } else if (top) {
    const def = VITALS[top.id];
    const note = readingNote(top, state, id);
    headline = `${def.label} ${readingValue(top)} ${def.unit}${note ? ` (${note})` : ''}`;
    action = top.pending
      ? def.confirm?.kind === 'symptom'
        ? `${def.confirm.question} Answer on your watch.`
        : 'Confirm with a fingerstick test on your watch.'
      : def.info.actions[top.level];
  }

  return (
    <div className="tablet__body">
      {titled && (
        <div className="tablet__group-head">
          <h3>My health</h3>
        </div>
      )}
      <section className={`tablet-status ${levelClass(s.status)}`}>
        <span className="tablet-status__badge">{s.status === 'nodata' ? 'No data' : LEVEL_NAMES[s.worst]}</span>
        <div className="tablet-status__text">
          <strong>{headline}</strong>
          <p>{action}</p>
          {s.connected && s.worst > 0 && <small>Who is told: {whoIsTold(s.worst)}</small>}
        </div>
      </section>

      {advisory && (
        <section className={`tablet-status ${isEva(state, id) ? 'lvl-2' : 'lvl-1'}`}>
          <span className="tablet-status__badge">Radiation</span>
          <div className="tablet-status__text">
            <strong>{isEva(state, id) ? 'Return to the vehicle now' : 'Move to the most shielded area'}</strong>
            <p>
              {advisory.source === 'simulated'
                ? 'Simulated solar particle event.'
                : 'NASA DONKI reports a solar particle event in the last 72 hours.'}
            </p>
          </div>
        </section>
      )}

      <BodyMap s={s} state={state} />

      <VitalTiles s={s} state={state} now={now} />

      <div className="tablet__cols">
        <section className="tablet__section">
          <h3>My recent events</h3>
          <Timeline items={timeline(state, id).slice(0, 6)} now={now} empty="Nothing yet." />
        </section>
        <section className="tablet__section">
          <h3>About my data</h3>
          <p>
            Glucose baseline: {Math.round(subject.preflightMean)} mg/dL fasting before flight, from anonymised Inspiration4 crew
            member {a.osdrSubject} (NASA OSDR {OSDR_GLUCOSE.accession}).
          </p>
          <p>Only you see this tablet view. Trends show the last 5 minutes; the shaded band is the nominal range.</p>
        </section>
      </div>
    </div>
  );
}

function CrewStatus({ state, now }: { state: RoomState | undefined; now: number }) {
  const summary = crewSummary(state, now);
  return (
    <section className="tablet__group" aria-labelledby="crew-status-title">
      <div className="tablet__group-head">
        <h3 id="crew-status-title">Crew status</h3>
        <span>Duty status only. Health values and the reason for an alert stay with each crew member and the medical officer.</span>
      </div>
      <ul className="duty-list">
        {CREW.map((a) => {
          const d = dutyStatus(summary.snapshots[a.id], state, now);
          const claim = state?.claims?.[a.id];
          return (
            <li key={a.id} className={`duty ${DUTY_LEVEL[d]}`}>
              <div className="duty__who">
                <Avatar id={a.id} size={26} />
                <strong>{a.name}</strong>
                <span className="duty__dot" aria-hidden="true" />
              </div>
              <span className="duty__where">
                {a.role} · {locationLabel(state, a.id)}
              </span>
              <strong className="duty__label">{DUTY_LABELS[d]}</strong>
              <span className="duty__hint">
                {(d === 'critical' || d === 'help') && claim ? `${CREW_BY_ID[claim.by].name} is responding.` : DUTY_HINTS[d]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CrewMedical({ state, now }: { state: RoomState | undefined; now: number }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  return (
    <div className="tablet__body">
      <MedicalOverview state={state} now={now} />
    </div>
  );
}

export const Tablet = memo(function Tablet({ astronautId, initialView }: { astronautId: AstronautId; initialView?: TabletView }) {
  const { state } = useRoom();
  const now = useNow(1000);
  const views = tabletViews(astronautId);
  const [picked, setPicked] = useState<TabletView>(initialView ?? 'self');
  const view = views.includes(picked) ? picked : 'self';
  const a = CREW_BY_ID[astronautId];
  const st = state ?? undefined;

  return (
    <div className="tablet">
      <div className="tablet__screen">
        <header className="tablet__bar">
          <div className="tablet__owner">
            <Avatar id={astronautId} size={32} />
            <strong>{a.name}</strong>
            <span>{a.role}</span>
          </div>
          <span className="tablet__clock">{missionClock(st, now, MISSION_DAY_OFFSET_MS)}</span>
        </header>
        {views.length > 1 && (
          <nav className="tablet__tabs" aria-label="Tablet views">
            {views.map((v) => (
              <button key={v} className={v === view ? 'is-active' : ''} aria-pressed={v === view} onClick={() => setPicked(v)}>
                {TABLET_VIEW_LABELS[v]}
              </button>
            ))}
          </nav>
        )}
        {view === 'self' && seesCrewStatus(astronautId) && <CrewStatus state={st} now={now} />}
        {view === 'self' && <MyHealth id={astronautId} state={st} now={now} titled={seesCrewStatus(astronautId)} />}
        {view === 'crewMedical' && <CrewMedical state={st} now={now} />}
        <footer className="tablet__foot">Simulated data</footer>
      </div>
    </div>
  );
});
