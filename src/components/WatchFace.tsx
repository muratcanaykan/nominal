// The astronaut's own wrist display: only their data, colour-coded alerts, guidance and a help button.

import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { PAIN_SITE_IDS, PAIN_SITES, type PainSite } from '../domain/body';
import { CREW_BY_ID, MISSION_DAY_OFFSET_MS, type AstronautId } from '../domain/crew';
import { missionClock, MOOD_MISSED_MS, MOOD_REMIND_MS, moodPromptStart, snapshot, type Reading } from '../domain/sim';
import { HAZARDS, LEVEL_NAMES, routingFor, VITALS, type Level, type VitalId } from '../domain/vitals';
import { isEva } from '../domain/locations';
import { useRoom, useStore } from '../lib/useRoom';
import { radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';
import { AnimatedNumber, formatAgo, HeartIcon, InfoIcon, levelClass, PainIcon, ShortLabel, SignalOffIcon } from './bits';
import { readingNote, readingValue } from './health';

const COMPLICATIONS: VitalId[] = ['spo2', 'bodyTemp', 'glucose'];

const VIBRATION: Record<Level, number[]> = {
  0: [],
  1: [90],
  2: [220, 120, 220],
  3: [500, 200, 500, 200, 500],
};

/** Heart-rate arc around the watch face. */
function Ring({ fraction }: { fraction: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  const c = 2 * Math.PI * 44;
  return (
    <svg className="ring ring--arc" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" className="arc-track" />
      <circle cx="50" cy="50" r="44" className="arc-fill" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 50 50)" />
    </svg>
  );
}

function Complication({ r }: { r: Reading }) {
  const def = VITALS[r.id];
  return (
    <div className={`comp ${levelClass(r.level)}`}>
      <span className="comp__label">
        <ShortLabel text={def.short} />
      </span>
      <span className="comp__value">
        <AnimatedNumber value={r.value} decimals={def.decimals} />
        <small>{def.unit}</small>
      </span>
    </div>
  );
}

function InfoSheet({
  readings,
  initial,
  onClose,
}: {
  readings: Record<VitalId, Reading>;
  initial: VitalId;
  onClose: () => void;
}) {
  const [vital, setVital] = useState<VitalId>(initial);
  const r = readings[vital];
  const def = VITALS[vital];
  const value = readingValue(r);
  return (
    <motion.div
      className="sheet"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
    >
      <div className="sheet__head">
        <span className={`sheet__badge ${levelClass(r.level)}`}>{LEVEL_NAMES[r.level]}</span>
        <button className="sheet__close" onClick={onClose} aria-label="Close guidance">
          ×
        </button>
      </div>
      <h3 className="sheet__title">
        {def.label} <span className={levelClass(r.level)}>{value} {def.unit}</span>
      </h3>
      {r.level > 0 && <p className="sheet__action">{def.info.actions[r.level]}</p>}
      <p className="sheet__text">{def.info.what}</p>
      <p className="sheet__text sheet__text--dim">{def.info.why}</p>
      <div className="sheet__hazards">
        {def.hazards.map((h) => (
          <span key={h} className="chip">
            {HAZARDS[h].label}
          </span>
        ))}
      </div>
      <div className="sheet__list">
        {(Object.keys(readings) as VitalId[]).filter((id) => !readings[id].inactive).map((id) => (
          <button
            key={id}
            className={`sheet__item ${levelClass(readings[id].level)}${id === vital ? ' is-active' : ''}`}
            onClick={() => setVital(id)}
          >
            <ShortLabel text={VITALS[id].short} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

const PAIN_LEVELS: [string, number][] = [
  ['Mild', 2],
  ['Moderate', 4],
  ['Severe', 8],
];

function PainSheet({
  reported,
  onReport,
  onClear,
  onClose,
}: {
  reported: boolean;
  onReport: (site: PainSite, value: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [site, setSite] = useState<PainSite | null>(null);
  return (
    <motion.div
      className="sheet pain"
      role="dialog"
      aria-label="Report joint pain"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
    >
      <div className="sheet__head">
        <span className="sheet__badge lvl-1">Report pain</span>
        <button className="sheet__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {!site ? (
        <>
          <h3 className="sheet__title">Where does it hurt?</h3>
          <div className="pain__grid">
            {PAIN_SITE_IDS.map((id) => (
              <button key={id} onClick={() => setSite(id)}>
                {PAIN_SITES[id].label}
              </button>
            ))}
          </div>
          {reported && (
            <button className="pain__clear" onClick={onClear}>
              No pain now
            </button>
          )}
        </>
      ) : (
        <>
          <h3 className="sheet__title">{PAIN_SITES[site].label}: how bad?</h3>
          <div className="pain__grid pain__grid--3">
            {PAIN_LEVELS.map(([label, value]) => (
              <button key={label} onClick={() => onReport(site, value)}>
                {label}
              </button>
            ))}
          </div>
          <p className="sheet__text sheet__text--dim">
            In the suit, joint pain can be decompression sickness, so the medical officer is told.
          </p>
        </>
      )}
    </motion.div>
  );
}

const MOOD_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Very good'];

function MoodPrompt({ onPick, elapsed }: { onPick: (value: number) => void; elapsed: number }) {
  const missed = elapsed >= MOOD_MISSED_MS;
  return (
    <motion.div
      className={`mood${elapsed >= MOOD_REMIND_MS ? ' is-reminder' : ''}${missed ? ' is-missed' : ''}`}
      role="dialog"
      aria-label="Mood check-in"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
    >
      <span className="mood__eyebrow">{elapsed >= MOOD_REMIND_MS ? 'Reminder · mood check-in' : 'Mood check-in'}</span>
      <p className="mood__q">How are you feeling right now?</p>
      <div className="mood__scale">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} className={`mood__btn mood__btn--${v}`} onClick={() => onPick(v)} aria-label={`${v}, ${MOOD_LABELS[v - 1]}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="mood__ends">
        <span>Very low</span>
        <span>Very good</span>
      </div>
      {missed ? (
        <span className="mood__missed">Not answered · {formatAgo(elapsed)} · your medical officer sees this</span>
      ) : (
        <span className="mood__note">Private. Only the medical officer sees trends.</span>
      )}
    </motion.div>
  );
}

function Keypad({ onSubmit, onCancel }: { onSubmit: (value: number) => void; onCancel: () => void }) {
  const [v, setV] = useState('');
  const num = Number(v);
  const valid = v.length > 0 && num >= 20 && num <= 600;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <motion.div
      className="keypad"
      role="dialog"
      aria-label="Enter fingerstick glucose"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
    >
      <div className="keypad__head">
        <span>Fingerstick glucose</span>
        <button className="keypad__close" onClick={onCancel} aria-label="Cancel">
          ×
        </button>
      </div>
      <span className="keypad__display" aria-live="polite">
        {v || '—'}
        <small>mg/dL</small>
      </span>
      <div className="keypad__grid">
        {keys.map((k) =>
          k === 'del' ? (
            <button key={k} onClick={() => setV((prev) => prev.slice(0, -1))} aria-label="Delete">
              ⌫
            </button>
          ) : k === 'ok' ? (
            <button key={k} className="keypad__ok" disabled={!valid} onClick={() => onSubmit(num)} aria-label="Save">
              ✓
            </button>
          ) : (
            <button key={k} onClick={() => setV((prev) => (prev.length < 3 ? prev + k : prev))}>
              {k}
            </button>
          ),
        )}
      </div>
    </motion.div>
  );
}

export function WatchFace({ astronautId, now }: { astronautId: AstronautId; now: number }) {
  const { state } = useRoom();
  const store = useStore();
  const reduce = useReducedMotion();
  const [scope, animateCase] = useAnimate();
  const [info, setInfo] = useState<VitalId | null>(null);
  const [keypad, setKeypad] = useState(false);
  const [pain, setPain] = useState(false);
  const astronaut = CREW_BY_ID[astronautId];
  const snap = snapshot(state ?? undefined, astronautId, now);
  const hr = snap.readings.heartRate;
  const alert = snap.connected ? snap.alert : undefined;
  const help = state?.help?.[astronautId];
  const status = snap.status;

  // Radiation advisory (NASA DONKI or simulated): spacewalk crew get a warning, everyone else a caution.
  const weather = useSpaceWeather();
  const advisory = radiationAdvisory(state, weather, now);
  const eva = isEva(state, astronautId);
  const radLevel: Level = eva ? 2 : 1;
  const showRad = snap.connected && !!advisory && !alert && !state?.acks?.[astronautId]?.[`radiation-${radLevel}`];

  // Vibrate and shake when a new alert appears or escalates.
  const alertKey = alert ? `${alert.id}-${alert.level}` : '';
  const signalKey = alertKey || (showRad ? `radiation-${radLevel}` : '');
  const signalLevel: Level = alert ? alert.level : showRad ? radLevel : 0;
  const lastKey = useRef('');
  useEffect(() => {
    if (!signalKey || signalKey === lastKey.current) {
      lastKey.current = signalKey;
      return;
    }
    lastKey.current = signalKey;
    const pattern = VIBRATION[signalLevel];
    if (pattern.length && 'vibrate' in navigator) navigator.vibrate(pattern);
    if (!reduce && signalLevel >= 2 && scope.current) {
      animateCase(scope.current, { x: [0, -7, 7, -5, 5, -2, 0] }, { duration: 0.5 });
    }
  }, [signalKey, signalLevel, reduce, scope, animateCase]);

  // Mood check-in: a reminder vibration after 10 s without an answer, and an "unanswered" note after 30 s.
  const moodSince = snap.connected ? moodPromptStart(state ?? undefined, astronautId, now, MISSION_DAY_OFFSET_MS) : null;
  const moodElapsed = moodSince === null ? 0 : now - moodSince;
  const remindKey = moodSince !== null && moodElapsed >= MOOD_REMIND_MS ? String(moodSince) : '';
  const reminded = useRef('');
  useEffect(() => {
    if (!remindKey || reminded.current === remindKey) return;
    reminded.current = remindKey;
    if ('vibrate' in navigator) navigator.vibrate([180, 120, 180]);
    if (!reduce && scope.current) animateCase(scope.current, { x: [0, -5, 5, -3, 3, 0] }, { duration: 0.45 });
  }, [remindKey, reduce, scope, animateCase]);

  const confirm = alert ? VITALS[alert.id].confirm : undefined;
  const bannerNote = alert ? readingNote(alert, state, astronautId) : '';
  const fraction = (hr.value - 40) / (180 - 40);
  const askMood = moodSince !== null;

  return (
    <div className={`watch ${levelClass(status)}`}>
      <div className="watch__case" ref={scope}>
        <div className="watch__screen">
          <Ring fraction={snap.connected ? fraction : 0} />

          <div className="watch__top">
            <span className="watch__callsign">{astronaut.callsign}</span>
            <span className="watch__clock">{missionClock(state ?? undefined, now, MISSION_DAY_OFFSET_MS)}</span>
          </div>

          <div className={`watch__hero ${levelClass(snap.connected ? hr.level : 'nodata')}`}>
            <HeartIcon bpm={hr.value} still={!snap.connected || !!reduce} />
            <AnimatedNumber value={hr.value} />
            <span className="watch__unit">bpm</span>
          </div>

          <div className="watch__comps">
            {COMPLICATIONS.map((id) => (
              <Complication key={id} r={snap.readings[id]} />
            ))}
          </div>

          <div className="watch__actions">
            <button className="btn-round" onClick={() => setInfo(snap.top?.id ?? 'heartRate')} aria-label="Explain my readings">
              <InfoIcon />
            </button>
            <button className="btn-round" onClick={() => setPain(true)} aria-label="Report joint pain">
              <PainIcon />
            </button>
            <button
              className={`btn-help${help ? ' is-active' : ''}`}
              onClick={() => (help ? store.cancelHelp(astronautId) : store.requestHelp(astronautId))}
            >
              {help ? 'Cancel help' : 'Help'}
            </button>
          </div>

          <AnimatePresence>
            {alert && alert.level < 3 && (
              <motion.div
                key={alertKey}
                className={`banner ${levelClass(alert.level)}`}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <div className="banner__text">
                  <strong>{LEVEL_NAMES[alert.level]}</strong>
                  <span>
                    {VITALS[alert.id].label} {readingValue(alert)} {VITALS[alert.id].unit}
                    {alert.pending ? ' (sensor)' : bannerNote ? ` (${bannerNote})` : ''}
                  </span>
                  {alert.pending && <em>{confirm?.kind === 'symptom' ? confirm.question : 'Confirm with a fingerstick test'}</em>}
                  {routingFor(alert.level).cmo && <em>Medical officer notified</em>}
                </div>
                <div className="banner__buttons">
                  {alert.pending && confirm?.kind === 'symptom' ? (
                    <>
                      <button onClick={() => store.answerSymptom(astronautId, alert.id, true)}>Yes</button>
                      <button onClick={() => store.answerSymptom(astronautId, alert.id, false)}>No</button>
                    </>
                  ) : (
                    <>
                      {alert.pending ? (
                        <button onClick={() => setKeypad(true)}>Fingerstick</button>
                      ) : (
                        <button onClick={() => setInfo(alert.id)}>What to do</button>
                      )}
                      <button onClick={() => store.acknowledge(astronautId, alert.id, alert.level)}>OK</button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showRad && (
              <motion.div
                key="radiation"
                className={`banner ${levelClass(radLevel)}`}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <div className="banner__text">
                  <strong>Radiation advisory</strong>
                  <span>Solar particle event</span>
                  <em>{eva ? 'Return to the vehicle now' : 'Move to the most shielded area'}</em>
                </div>
                <div className="banner__buttons">
                  <button onClick={() => store.acknowledgeAdvisory(astronautId, radLevel)}>OK</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {alert && alert.level === 3 && !info && (
              <motion.div
                className="critical"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {!reduce && (
                  <motion.span
                    className="critical__pulse"
                    aria-hidden="true"
                    animate={{ opacity: [0, 0.45, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <span className="critical__label">Critical</span>
                <span className="critical__value">
                  <ShortLabel text={VITALS[alert.id].short} /> {readingValue(alert)}
                  <small>{VITALS[alert.id].unit}</small>
                </span>
                <span className="critical__note">Crew and flight surgeons notified</span>
                <button onClick={() => setInfo(alert.id)}>What to do</button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!snap.connected && (
              <motion.div className="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SignalOffIcon />
                <strong>No sensor data</strong>
                <span>Last update {formatAgo(now - snap.readingsAt)} ago</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {help && !info && (
              <motion.div className="help-toast" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
                Help requested · crew notified
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {askMood && !info && !keypad && !pain && !(alert && alert.level === 3) && (
              <MoodPrompt key="mood" elapsed={moodElapsed} onPick={(value) => store.submitMood(astronautId, value)} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {keypad && (
              <Keypad
                key="keypad"
                onCancel={() => setKeypad(false)}
                onSubmit={(value) => {
                  store.submitGlucoseCheck(astronautId, value);
                  setKeypad(false);
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {pain && (
              <PainSheet
                key="pain"
                reported={!!state?.reports?.[astronautId]?.jointPain}
                onClose={() => setPain(false)}
                onClear={() => {
                  store.clearPain(astronautId);
                  setPain(false);
                }}
                onReport={(site, value) => {
                  store.reportPain(astronautId, site, value);
                  setPain(false);
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {info && <InfoSheet key="sheet" readings={snap.readings} initial={info} onClose={() => setInfo(null)} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
