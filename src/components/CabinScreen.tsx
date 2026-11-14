// Shared cabin display: connectivity and only the alerts that need crew action. No routine values.

import { AnimatePresence, motion } from 'motion/react';
import { CREW, CREW_BY_ID, MISSION_DAY_OFFSET_MS, PROFILES, type AstronautId } from '../domain/crew';
import { crewSummary, missionClock, type CrewAlert } from '../domain/sim';
import { DONKI_LABELS, formatDay, radiationAdvisory, useSpaceWeather, type Advisory } from '../data/spaceWeather';
import { isEva, locationLabel } from '../domain/locations';
import { responseSteps } from '../domain/response';
import { useRoom, useStore } from '../lib/useRoom';
import { formatAgo, formatDelay } from './bits';
import { CabinView3D } from './CabinView3D';
import { CrewMap } from './CrewMap';

function EventCard({ alert, now, viewer }: { alert: CrewAlert; now: number; viewer: AstronautId }) {
  const store = useStore();
  const { state } = useRoom();
  const a = CREW_BY_ID[alert.astronautId];
  const cmo = CREW.find((c) => c.cmo);
  const delay = PROFILES[state?.profile ?? 'lunar'].earthDelayMs;
  const since = alert.since ?? now;
  const remaining = since + delay - now;
  const steps = responseSteps(alert, state);

  return (
    <motion.article
      layout
      className="event"
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      <header className="event__head">
        <span className="event__kind">{alert.kind === 'help' ? 'Help requested' : 'Help needed'}</span>
        <span className="event__time">{formatAgo(now - since)}</span>
      </header>
      <h3 className="event__name">{a.name}</h3>
      <dl className="event__facts">
        <div>
          <dt>Location</dt>
          <dd>{locationLabel(state, a.id)}</dd>
        </div>
        <div>
          <dt>Response</dt>
          <dd>{steps.join(' · ')}</dd>
        </div>
        <div>
          <dt>Notified</dt>
          <dd>
            {cmo ? `${cmo.name} (medical officer)` : 'Medical officer'} ·{' '}
            {remaining > 0 ? `Earth in ${formatDelay(remaining)}` : 'Flight surgeons on Earth'}
          </dd>
        </div>
      </dl>
      <footer className="event__foot">
        {alert.claimedBy ? (
          <>
            <span className="event__claimed">
              {CREW_BY_ID[alert.claimedBy].name} is responding · {formatAgo(now - (alert.claimedAt ?? now))}
            </span>
            <button className="btn-ghost" onClick={() => store.resolve(alert.astronautId)}>
              Resolve
            </button>
          </>
        ) : (
          <button className="btn-claim" onClick={() => store.claim(alert.astronautId, viewer)}>
            I'm responding
          </button>
        )}
      </footer>
    </motion.article>
  );
}

function AdvisoryCard({ advisory, now }: { advisory: Advisory; now: number }) {
  const { state } = useRoom();
  const eva = CREW.filter((c) => isEva(state, c.id));
  return (
    <motion.article
      layout
      className="event event--advisory"
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      <header className="event__head">
        <span className="event__kind">Radiation advisory</span>
        <span className="event__time">{formatAgo(now - advisory.since)}</span>
      </header>
      <h3 className="event__name">Solar particle event</h3>
      <dl className="event__facts">
        <div>
          <dt>Response</dt>
          <dd>
            {eva.length > 0 && `${eva.map((c) => c.name).join(', ')}: return to the vehicle · `}All crew: move to the most shielded area
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{advisory.source === 'simulated' ? 'Simulated for this demo' : 'NASA DONKI solar energetic particle event'}</dd>
        </div>
      </dl>
    </motion.article>
  );
}

/** `locations`: `3d` shows the live 3D view of the vehicle (default); `map` shows the flat crew map. */
export function CabinScreen({
  now,
  viewer = '04',
  locations = '3d',
  foreground = false,
}: {
  now: number;
  viewer?: AstronautId;
  locations?: '3d' | 'map';
  /** Opened in front of the full-screen simulation: keep its 3D view running. */
  foreground?: boolean;
}) {
  const { state } = useRoom();
  const summary = crewSummary(state ?? undefined, now);
  const profile = PROFILES[state?.profile ?? 'lunar'];
  const alerting = new Set(summary.alerts.map((a) => a.astronautId));
  const crew = [...CREW].sort((x, y) => Number(alerting.has(y.id)) - Number(alerting.has(x.id)));
  const n = summary.alerts.length;
  const weather = useSpaceWeather();
  const advisory = radiationAdvisory(state, weather, now);
  const lastEvent = [...(weather?.notifications ?? [])]
    .filter((e) => e.type !== 'Report')
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
  const map = (
    <CrewMap state={state} alerting={alerting} offline={new Set(CREW.filter((a) => !summary.snapshots[a.id].connected).map((a) => a.id))} />
  );
  const statusMain = n
    ? `${n} crew alert${n > 1 ? 's' : ''}${advisory ? ' · radiation advisory' : ''}`
    : advisory
      ? 'Radiation advisory'
      : 'No active crew alerts';

  return (
    <section className={`cabin${n ? ' has-alert' : ''}`} aria-label="Cabin crew status screen">
      <header className="cabin__bar">
        <div className="cabin__brand">
          <span className="cabin__logo">Nominal</span>
          <span className="cabin__sub">Crew health</span>
        </div>
        <div className="cabin__meta">
          <span>MET {missionClock(state ?? undefined, now, MISSION_DAY_OFFSET_MS)}</span>
          <span>{profile.label}</span>
          <span>Earth link {formatDelay(profile.earthDelayMs)}</span>
        </div>
      </header>

      <div className={`cabin__status${n ? ' is-alert' : advisory ? ' is-advisory' : ''}`} role="status">
        <span className="cabin__status-main">{statusMain}</span>
        <span className="cabin__status-sub">
          {summary.connected}/{summary.total} devices connected
        </span>
      </div>

      <div className="cabin__events">
        <AnimatePresence initial={false}>
          {advisory && <AdvisoryCard key="radiation" advisory={advisory} now={now} />}
          {summary.alerts.map((a) => (
            <EventCard key={`${a.astronautId}-${a.kind}`} alert={a} now={now} viewer={viewer} />
          ))}
        </AnimatePresence>
      </div>

      {locations === '3d' ? <CabinView3D fallback={map} foreground={foreground} /> : map}

      <ul className="cabin__crew">
        {crew.map((a) => {
          const s = summary.snapshots[a.id];
          return (
            <motion.li
              layout
              key={a.id}
              className={`crew${alerting.has(a.id) ? ' is-alert' : ''}${s.connected ? '' : ' is-offline'}`}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <span className="crew__dot" aria-hidden="true" />
              <span className="crew__name">{a.name}</span>
              <span className="crew__role">{a.role}</span>
              <span className="crew__loc">{locationLabel(state, a.id)}</span>
              <span className="crew__dev">
                {s.connected ? 'Connected' : `No data · ${formatAgo(now - s.readingsAt)}`}
              </span>
            </motion.li>
          );
        })}
      </ul>

      <footer className="cabin__note">
        <span>Routine health values stay private to each crew member · Simulated data</span>
        {weather && (
          <span>
            Space weather (NASA DONKI):{' '}
            {lastEvent ? `${DONKI_LABELS[lastEvent.type] ?? lastEvent.type}, ${formatDay(lastEvent.time)}` : 'no events in 30 days'}
          </span>
        )}
      </footer>
    </section>
  );
}
