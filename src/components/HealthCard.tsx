// Card that opens beside a 3D view when an astronaut is selected.
// `full` (the demo simulation): every reading with a short trend, and the body map.
// `cabin` (the shared cabin screen): who and where, the watch connection and crew alerts only. Health values never
// show there; the crew member themselves or the medical officer can jump to their own tablet instead.

import type { BodyRegion } from '../domain/body';
import { CREW_BY_ID, type AstronautId } from '../domain/crew';
import { isSuited, locationLabel } from '../domain/locations';
import { responseSteps } from '../domain/response';
import { forecast, forecastText } from '../domain/forecast';
import { crewSummary, snapshot } from '../domain/sim';
import { LEVEL_NAMES, VITAL_IDS, VITALS, type VitalId } from '../domain/vitals';
import type { RoomState } from '../domain/room';
import type { Snapshot } from '../domain/sim';
import { useNow, useRoom } from '../lib/useRoom';
import { Avatar } from './Avatar';
import { formatAgo, levelClass, ShortLabel } from './bits';
import { BodyMap } from './BodyMap';
import { RadiationLine } from './Radiation';
import { icons } from './icons';
import { readingNote, readingValue, showsTile, Sparkline } from './health';
import { RegionDetails } from './RegionDetails';

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

/** Body map and every reading with a short trend. */
function Readings({
  id,
  s,
  state,
  now,
  onRegion,
}: {
  id: AstronautId;
  s: Snapshot;
  state: RoomState | undefined;
  now: number;
  onRegion?: (region: BodyRegion) => void;
}) {
  return (
    <div className="hcard__body">
      <div className="hcard__map">
        <BodyMap s={s} state={state} compact onRegion={onRegion} />
      </div>
      <ul className="hcard__vitals">
        {VITAL_IDS.filter((v) => showsTile(s.readings[v])).map((v) => {
          const r = s.readings[v];
          const def = VITALS[v];
          const note = readingNote(r, state, id);
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
              {TRENDS.includes(v) ? <Sparkline state={state} id={id} vital={v} now={now} /> : <span className="hcard__nospark" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FullCard({
  id,
  onClose,
  region,
  onRegion,
}: {
  id: AstronautId;
  onClose: () => void;
  region?: BodyRegion | null;
  onRegion?: (region: BodyRegion | null) => void;
}) {
  const { state } = useRoom();
  const now = useNow(1000);
  const st = state ?? undefined;
  const s = snapshot(st, id, now);
  const status = s.status === 'nodata' ? `No data · ${formatAgo(now - s.readingsAt)}` : LEVEL_NAMES[s.worst];
  return (
    <aside className="hcard" aria-label={`Health of ${CREW_BY_ID[id].name}`}>
      <CardHead id={id} status={status} statusLevel={levelClass(s.status)} onClose={onClose} />
      {(() => {
        const fc = s.connected ? forecast(st, id, now) : null;
        return fc ? <p className={`hcard__trend ${levelClass(fc.level)}`}>Early warning · {forecastText(fc)}</p> : null;
      })()}
      <RadiationLine id={id} state={st} now={now} />
      {region && onRegion ? (
        <RegionDetails region={region} s={s} state={st} onClose={() => onRegion(null)} />
      ) : (
        <Readings id={id} s={s} state={st} now={now} onRegion={onRegion} />
      )}
      <p className="hcard__foot">Click a body region for details · simulated data · trends: last 5 minutes</p>
    </aside>
  );
}

/** Who has the values on their own tablet: the crew member themselves, or the medical officer. */
function tabletRole(viewer: AstronautId | undefined, id: AstronautId): 'self' | 'cmo' | null {
  if (!viewer) return null;
  if (viewer === id) return 'self';
  return CREW_BY_ID[viewer].cmo ? 'cmo' : null;
}

function CabinCard({
  id,
  viewer,
  onClose,
  onOpenTablet,
}: {
  id: AstronautId;
  viewer?: AstronautId;
  onClose: () => void;
  onOpenTablet?: (id: AstronautId) => void;
}) {
  const { state } = useRoom();
  const now = useNow(1000);
  const st = state ?? undefined;
  const summary = crewSummary(st, now);
  const s = summary.snapshots[id];
  const alert = summary.alerts.find((x) => x.astronautId === id);
  const claim = st?.claims?.[id];
  const role = tabletRole(viewer, id);
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
        <span>Health values never show on the shared cabin screen. They stay on the crew member's own devices and with the medical officer.</span>
      </p>
      {role && onOpenTablet && (
        <button className="hcard__reveal" onClick={() => onOpenTablet(id)}>
          {icons.tablet}
          <span>
            <strong>Open on my tablet</strong>
            <small>{role === 'self' ? 'See your own values privately' : `See ${CREW_BY_ID[id].name.split(' ')[0]} in crew medical`}</small>
          </span>
        </button>
      )}
    </aside>
  );
}

/**
 * `viewer` and `onOpenTablet` (cabin only): the crew member using the shared screen can jump to their own tablet, where
 * they see their own values (or, as medical officer, the crew medical view).
 */
export function HealthCard({
  id,
  mode,
  viewer,
  onClose,
  onOpenTablet,
  region,
  onRegion,
}: {
  id: AstronautId;
  mode: 'full' | 'cabin';
  viewer?: AstronautId;
  onClose: () => void;
  onOpenTablet?: (id: AstronautId) => void;
  /** Full card: the body region shown in detail (from the body map or a click on the 3D astronaut). */
  region?: BodyRegion | null;
  onRegion?: (region: BodyRegion | null) => void;
}) {
  return mode === 'full' ? (
    <FullCard id={id} onClose={onClose} region={region} onRegion={onRegion} />
  ) : (
    <CabinCard id={id} viewer={viewer} onClose={onClose} onOpenTablet={onOpenTablet} />
  );
}
