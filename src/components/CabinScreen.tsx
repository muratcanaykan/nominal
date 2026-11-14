// Shared cabin display: connectivity and only the alerts that need crew action. No routine values.

import { AnimatePresence, motion } from 'motion/react';
import { CREW, CREW_BY_ID, MISSION_DAY_OFFSET_MS, PROFILES, type AstronautId } from '../domain/crew';
import { crewSummary, missionClock, type CrewAlert } from '../domain/sim';
import type { VitalId } from '../domain/vitals';
import { useRoom, useStore } from '../lib/useRoom';
import { formatAgo, formatDelay, type Variant } from './bits';

const RESPONSE_STEP: Record<VitalId | 'help', string> = {
  spo2: 'Bring the emergency oxygen kit',
  heartRate: 'Bring the medical kit and defibrillator',
  bloodPressure: 'Bring the medical kit',
  bodyTemp: 'Bring the medical kit and prepare cooling',
  glucose: 'Bring fast-acting carbohydrate',
  sleep: 'Check on the crew member',
  mood: 'Check on the crew member',
  help: 'Go to the crew member now',
};

function EventCard({ alert, now, viewer }: { alert: CrewAlert; now: number; viewer: AstronautId }) {
  const store = useStore();
  const { state } = useRoom();
  const a = CREW_BY_ID[alert.astronautId];
  const cmo = CREW.find((c) => c.cmo);
  const delay = PROFILES[state?.profile ?? 'lunar'].earthDelayMs;
  const since = alert.since ?? now;
  const remaining = since + delay - now;
  const steps = [RESPONSE_STEP[alert.kind === 'help' ? 'help' : alert.vital ?? 'help']];
  if (a.onEva) steps.push('Prepare the airlock for early return');

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
          <dd>{a.location}</dd>
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

export function CabinScreen({ variant, now, viewer = '04' }: { variant: Variant; now: number; viewer?: AstronautId }) {
  const { state } = useRoom();
  const summary = crewSummary(state ?? undefined, now);
  const profile = PROFILES[state?.profile ?? 'lunar'];
  const alerting = new Set(summary.alerts.map((a) => a.astronautId));
  const crew = [...CREW].sort((x, y) => Number(alerting.has(y.id)) - Number(alerting.has(x.id)));
  const n = summary.alerts.length;

  return (
    <section className={`cabin v-${variant}${n ? ' has-alert' : ''}`} aria-label="Cabin crew status screen">
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

      <div className={`cabin__status${n ? ' is-alert' : ''}`} role="status">
        <span className="cabin__status-main">{n ? `${n} crew alert${n > 1 ? 's' : ''}` : 'No active crew alerts'}</span>
        <span className="cabin__status-sub">
          {summary.connected}/{summary.total} devices connected
        </span>
      </div>

      <div className="cabin__events">
        <AnimatePresence initial={false}>
          {summary.alerts.map((a) => (
            <EventCard key={`${a.astronautId}-${a.kind}`} alert={a} now={now} viewer={viewer} />
          ))}
        </AnimatePresence>
      </div>

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
              <span className="crew__loc">{a.location}</span>
              <span className="crew__dev">
                {s.connected ? 'Connected' : `No data · ${formatAgo(now - s.readingsAt)}`}
              </span>
            </motion.li>
          );
        })}
      </ul>

      <footer className="cabin__note">Routine health values stay private to each crew member · Simulated data</footer>
    </section>
  );
}
