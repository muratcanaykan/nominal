// Shared cabin display: connectivity and only the alerts that need crew action. No routine values.

import { AnimatePresence, motion } from 'motion/react';
import { CREW, CREW_BY_ID, MISSION_DAY_OFFSET_MS, PROFILES, type AstronautId } from '../domain/crew';
import { crewSummary, missionClock, type CrewAlert } from '../domain/sim';
import { DONKI_LABELS, formatDay, radiationAdvisory, useSpaceWeather, type Advisory } from '../data/spaceWeather';
import { isEva, locationLabel } from '../domain/locations';
import { countdown, latestAbout, replyAt } from '../domain/earth';
import { responseChecklist } from '../domain/response';
import { stageText } from './EarthLink';
import { useRoom, useStore } from '../lib/useRoom';
import { formatAgo, formatDelay } from './bits';
import { CabinView3D } from './CabinView3D';
import { CrewMap } from './CrewMap';
import { TetherPull } from './TetherPull';
import { pullOf } from '../domain/tether';

/** Shared response checklist: anyone on board ticks steps off; every screen sees who did what. */
function Checklist({ alert, now, viewer }: { alert: CrewAlert; now: number; viewer: AstronautId }) {
  const store = useStore();
  const { state } = useRoom();
  const steps = responseChecklist(alert, state);
  const ticks = state?.checklists?.[alert.astronautId] ?? {};
  const done = steps.filter((s) => ticks[s.id]).length;
  // The person in trouble sees the steps but does not tick them: crewmates do.
  const self = viewer === alert.astronautId;
  return (
    <div className="check">
      <div className="check__head">
        <span>Response checklist</span>
        <span className="check__count">
          {done}/{steps.length}
        </span>
      </div>
      <div className="check__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${done / steps.length})` }} />
      </div>
      <ol className="check__list">
        {steps.map((step, i) => {
          const t = ticks[step.id];
          return (
            <li key={step.id}>
              <button
                className={`check__item${t ? ' is-done' : ''}`}
                aria-pressed={!!t}
                disabled={self}
                onClick={() => store.checkStep(alert.astronautId, step.id, viewer, !t)}
              >
                <span className="check__box" aria-hidden="true">
                  {t ? '✓' : i + 1}
                </span>
                <span className="check__text">
                  {step.text}
                  {step.id === 'earth' && t && (() => {
                    const m = latestAbout(state, alert.astronautId, t.at);
                    return m ? <small className="check__sub">{stageText(m, now)}</small> : null;
                  })()}
                </span>
                {t && (
                  <span className="check__by">
                    {CREW_BY_ID[t.by].callsign} · {formatAgo(now - t.at)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {self && done < steps.length && <p className="check__note">Your crewmates tick these steps.</p>}
      {done === steps.length && <p className="check__done">All steps done. Resolve the alert once {CREW_BY_ID[alert.astronautId].name} is stable.</p>}
    </div>
  );
}

function EventCard({ alert, now, viewer }: { alert: CrewAlert; now: number; viewer: AstronautId }) {
  const store = useStore();
  const { state } = useRoom();
  const a = CREW_BY_ID[alert.astronautId];
  const cmo = CREW.find((c) => c.cmo);
  const delay = PROFILES[state?.profile ?? 'lunar'].earthDelayMs;
  const since = alert.since ?? now;
  const remaining = since + delay - now;
  const pull = pullOf(state, a.id, now);

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
          <dd>
            {pull?.active ? 'Spacewalk · coming in on the tether' : locationLabel(state, a.id)}
            {pull && !pull.active && ` · pulled in by ${CREW_BY_ID[pull.by].callsign}`}
          </dd>
        </div>
        <div>
          <dt>Notified</dt>
          <dd>
            {cmo ? `${cmo.name} (medical officer)` : 'Medical officer'} ·{' '}
            {remaining > 0 ? `Earth in ${formatDelay(remaining)}` : 'Flight surgeons on Earth'}
            {(() => {
              // Only where the conversation is; its content stays on the medical officer's tablet.
              const m = latestAbout(state, a.id, since);
              if (!m) return null;
              return now >= replyAt(m) ? " · reply on the medical officer's tablet" : ` · update sent, reply in ${countdown(replyAt(m) - now)}`;
            })()}
          </dd>
        </div>
      </dl>
      <TetherPull id={a.id} by={viewer} now={now} />
      <Checklist alert={alert} now={now} viewer={viewer} />
      <footer className="event__foot">
        {viewer === alert.astronautId ? (
          <>
            <p className="event__self">
              {alert.kind === 'help'
                ? 'You called for help. Your crew has been told; stay where you are.'
                : 'Your crew has been called. Stay where you are; help is coming.'}
            </p>
            {alert.claimedBy && (
              <span className="event__claimed">
                {CREW_BY_ID[alert.claimedBy].name} is responding · {formatAgo(now - (alert.claimedAt ?? now))}
              </span>
            )}
          </>
        ) : alert.claimedBy ? (
          <>
            <span className="event__claimed">
              {CREW_BY_ID[alert.claimedBy].name} is responding · {formatAgo(now - (alert.claimedAt ?? now))}
            </span>
            <button className="btn-ghost" onClick={() => store.resolve(alert.astronautId, viewer)}>
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
  onOpenTablet,
}: {
  now: number;
  viewer?: AstronautId;
  locations?: '3d' | 'map';
  /** Opened in front of the full-screen simulation: keep its 3D view running. */
  foreground?: boolean;
  /** Where the page also shows the viewer's tablet: "Open on my tablet" from a crew member card. */
  onOpenTablet?: (id: AstronautId) => void;
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

      {locations === '3d' ? <CabinView3D fallback={map} foreground={foreground} viewer={viewer} onOpenTablet={onOpenTablet} /> : map}

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
