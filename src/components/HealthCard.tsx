// Card that opens beside a 3D view when an astronaut is selected.
// `full` (the demo simulation): every reading with a short trend, and the body map.
// `cabin` (the shared cabin screen): who and where, the watch connection and crew alerts only. Health values stay
// private there: only the crew member themselves (by choice) or the medical officer (with the demo PIN) can open them
// on the shared screen, and they hide again when the card closes.

import { CREW_BY_ID, type AstronautId } from '../domain/crew';
import { isSuited, locationLabel } from '../domain/locations';
import { responseSteps } from '../domain/response';
import { crewSummary, snapshot } from '../domain/sim';
import { LEVEL_NAMES, VITAL_IDS, VITALS, type VitalId } from '../domain/vitals';
import { useState, type FormEvent } from 'react';
import type { RoomState } from '../domain/room';
import type { Snapshot } from '../domain/sim';
import { useNow, useRoom } from '../lib/useRoom';
import { Avatar } from './Avatar';
import { formatAgo, levelClass, ShortLabel } from './bits';
import { BodyMap } from './BodyMap';
import { icons } from './icons';
import { readingNote, readingValue, showsTile, Sparkline } from './health';
import { DEMO_PIN, markUnlocked, readUnlocked } from './MedicalView';

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
function Readings({ id, s, state, now }: { id: AstronautId; s: Snapshot; state: RoomState | undefined; now: number }) {
  return (
    <div className="hcard__body">
      <div className="hcard__map">
        <BodyMap s={s} state={state} compact />
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

function FullCard({ id, onClose }: { id: AstronautId; onClose: () => void }) {
  const { state } = useRoom();
  const now = useNow(1000);
  const st = state ?? undefined;
  const s = snapshot(st, id, now);
  const status = s.status === 'nodata' ? `No data · ${formatAgo(now - s.readingsAt)}` : LEVEL_NAMES[s.worst];
  return (
    <aside className="hcard" aria-label={`Health of ${CREW_BY_ID[id].name}`}>
      <CardHead id={id} status={status} statusLevel={levelClass(s.status)} onClose={onClose} />
      <Readings id={id} s={s} state={st} now={now} />
      <p className="hcard__foot">Simulation view · simulated data · trends: last 5 minutes</p>
    </aside>
  );
}

/** Who may open health values on the shared screen: the crew member themselves, or the medical officer. */
function revealRole(viewer: AstronautId | undefined, id: AstronautId): 'self' | 'cmo' | null {
  if (!viewer) return null;
  if (viewer === id) return 'self';
  return CREW_BY_ID[viewer].cmo ? 'cmo' : null;
}

function Reveal({ id, viewer, onReveal }: { id: AstronautId; viewer: AstronautId | undefined; onReveal: () => void }) {
  const role = revealRole(viewer, id);
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const a = CREW_BY_ID[id];
  if (!role) {
    return (
      <p className="hcard__private">
        {icons.lock}
        <span>Health values stay private. Only {a.name.split(' ')[0]} and the medical officer can open them here.</span>
      </p>
    );
  }
  if (askPin) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (pin === DEMO_PIN) {
        markUnlocked();
        onReveal();
      } else setWrong(true);
    };
    return (
      <form className="hcard__pin" onSubmit={submit}>
        <label htmlFor={`cabin-pin-${id}`}>Medical officer PIN · demo PIN {DEMO_PIN}</label>
        <div>
          <input
            id={`cabin-pin-${id}`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            autoFocus
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setWrong(false);
            }}
          />
          <button type="submit">Open</button>
        </div>
        {wrong && <span className="hcard__pin-error">Wrong PIN. Use the demo PIN above.</span>}
      </form>
    );
  }
  return (
    <button
      className="hcard__reveal"
      onClick={() => {
        if (role === 'cmo' && !readUnlocked()) setAskPin(true);
        else onReveal();
      }}
    >
      {icons.lock}
      <span>
        <strong>{role === 'self' ? 'Show my health values' : 'Show health values'}</strong>
        <small>{role === 'self' ? 'Your choice; others near the screen will see them' : 'As medical officer, with your PIN'}</small>
      </span>
    </button>
  );
}

function CabinCard({ id, viewer, onClose }: { id: AstronautId; viewer?: AstronautId; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
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
      {revealed && viewer ? (
        <>
          <div className="hcard__shown">
            <span>
              Shown on the shared screen by {CREW_BY_ID[viewer].name}
              {viewer === id ? '' : ' (medical officer)'}
            </span>
            <button onClick={() => setRevealed(false)}>Hide</button>
          </div>
          <Readings id={id} s={snapshot(st, id, now)} state={st} now={now} />
        </>
      ) : (
        <Reveal id={id} viewer={viewer} onReveal={() => setRevealed(true)} />
      )}
    </aside>
  );
}

/** `viewer` (cabin only): the crew member using the shared screen, who may be allowed to open health values. */
export function HealthCard({ id, mode, viewer, onClose }: { id: AstronautId; mode: 'full' | 'cabin'; viewer?: AstronautId; onClose: () => void }) {
  return mode === 'full' ? <FullCard id={id} onClose={onClose} /> : <CabinCard id={id} viewer={viewer} onClose={onClose} />;
}
