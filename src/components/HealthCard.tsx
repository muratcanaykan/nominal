// Card that opens beside a 3D view when an astronaut is selected.
// `full` (the demo simulation): every reading with a short trend, and the body map.
// `cabin` (the shared cabin screen): who and where, the watch connection and crew alerts only. Health values stay
// with the crew member and the medical officer, as everywhere else on the cabin screen.

import { CREW_BY_ID, type AstronautId } from '../domain/crew';
import { isSuited, locationLabel } from '../domain/locations';
import { responseSteps } from '../domain/response';
import { crewSummary, snapshot } from '../domain/sim';
import { LEVEL_NAMES, VITAL_IDS, VITALS, type VitalId } from '../domain/vitals';
import { useNow, useRoom } from '../lib/useRoom';
import { Avatar } from './Avatar';
import { formatAgo, levelClass, ShortLabel } from './bits';
import { BodyMap } from './BodyMap';
import { icons } from './icons';
import { readingNote, readingValue, showsTile, Sparkline } from './health';

const TRENDS: VitalId[] = ['heartRate', 'spo2', 'bloodPressure', 'bodyTemp', 'glucose'];

function CardHead({ id, status, statusLevel, onClose }: { id: AstronautId; status: string; statusLevel: string; onClose: () => void }) {
  const { state } = useRoom();
  const a = CREW_BY_ID[id];
  return (
    <header className="hcard__head">
      <Avatar id={id} size={42} />
      <div className="hcard__who">
        <strong>{a.name}</strong>
        <span>{a.cmo ? 'Medical officer' : a.role}</span>
        <span className="hcard__where">
          {locationLabel(state, id)}
          {isSuited(state, id) && <em>Suited</em>}
        </span>
      </div>
      <button className="hcard__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <span className={`hcard__status ${statusLevel}`}>{status}</span>
    </header>
  );
}

function FullCard({ id, onClose }: { id: AstronautId; onClose: () => void }) {
  const { state } = useRoom();
  const now = useNow(1000);
  const st = state ?? undefined;
  const s = snapshot(st, id, now);
  const status = s.status === 'nodata' ? `No data · ${formatAgo(now - s.readingsAt)}` : LEVEL_NAMES[s.worst];
  return (
    <aside className="hcard" aria-label={`Health of ${CREW_BY_ID[id].name}`}>
      <CardHead id={id} status={status} statusLevel={levelClass(s.status)} onClose={onClose} />
      <div className="hcard__body">
        <div className="hcard__map">
          <BodyMap s={s} state={st} compact />
        </div>
        <ul className="hcard__vitals">
          {VITAL_IDS.filter((v) => showsTile(s.readings[v])).map((v) => {
            const r = s.readings[v];
            const def = VITALS[v];
            const note = readingNote(r, st, id);
            return (
              <li key={v} className={levelClass(s.connected ? r.level : 'nodata')}>
                <span className="hcard__label">
                  <ShortLabel text={def.short} />
                  {note && <em>{note}</em>}
                </span>
                <span className="hcard__value">
                  {readingValue(r)}
                  <small>{def.unit}</small>
                </span>
                {TRENDS.includes(v) ? <Sparkline state={st} id={id} vital={v} now={now} /> : <span className="hcard__nospark" />}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="hcard__foot">Simulation view · simulated data · trends: last 5 minutes</p>
    </aside>
  );
}

function CabinCard({ id, onClose }: { id: AstronautId; onClose: () => void }) {
  const { state } = useRoom();
  const now = useNow(1000);
  const st = state ?? undefined;
  const summary = crewSummary(st, now);
  const s = summary.snapshots[id];
  const alert = summary.alerts.find((x) => x.astronautId === id);
  const claim = st?.claims?.[id];
  let status = 'No active alerts';
  let level = 'lvl-0';
  if (alert) {
    status = alert.kind === 'help' ? 'Help requested' : 'Help needed';
    level = 'lvl-3';
  } else if (!s.connected) {
    status = 'No data';
    level = 'lvl-nodata';
  }
  return (
    <aside className="hcard hcard--cabin" aria-label={`Crew member ${CREW_BY_ID[id].name}`}>
      <CardHead id={id} status={status} statusLevel={level} onClose={onClose} />
      <dl className="hcard__facts">
        <div>
          <dt>Watch</dt>
          <dd>{s.connected ? 'Connected' : `No data · last update ${formatAgo(now - s.readingsAt)} ago`}</dd>
        </div>
        {alert && (
          <>
            <div className="is-alert">
              <dt>Response</dt>
              <dd>{responseSteps(alert, st).join(' · ')}</dd>
            </div>
            <div>
              <dt>Responding</dt>
              <dd>{claim ? CREW_BY_ID[claim.by].name : 'Nobody yet'}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="hcard__private">
        {icons.lock}
        <span>Health values stay with the crew member and the medical officer.</span>
      </p>
    </aside>
  );
}

export function HealthCard({ id, mode, onClose }: { id: AstronautId; mode: 'full' | 'cabin'; onClose: () => void }) {
  return mode === 'full' ? <FullCard id={id} onClose={onClose} /> : <CabinCard id={id} onClose={onClose} />;
}
