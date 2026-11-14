// The astronaut's own wrist display: only their data, colour-coded alerts, guidance and a help button.

import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CREW_BY_ID, MISSION_DAY_OFFSET_MS, type AstronautId } from '../domain/crew';
import { missionClock, snapshot, type Reading } from '../domain/sim';
import { HAZARDS, LEVEL_NAMES, routingFor, VITALS, type Level, type VitalId } from '../domain/vitals';
import { useRoom, useStore } from '../lib/useRoom';
import { AnimatedNumber, formatAgo, HeartIcon, InfoIcon, levelClass, ShortLabel, SignalOffIcon, type Variant } from './bits';

const COMPLICATIONS: VitalId[] = ['spo2', 'bodyTemp', 'glucose'];

const VIBRATION: Record<Level, number[]> = {
  0: [],
  1: [90],
  2: [220, 120, 220],
  3: [500, 200, 500, 200, 500],
};

function Ring({ variant, fraction }: { variant: Variant; fraction: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  if (variant === 'mission') {
    const lit = Math.round(f * 60);
    return (
      <svg className="ring ring--ticks" viewBox="0 0 100 100" aria-hidden="true">
        {Array.from({ length: 60 }, (_, i) => {
          const a = ((i * 6 - 90) * Math.PI) / 180;
          const major = i % 5 === 0;
          const r1 = major ? 41.5 : 43.5;
          return (
            <line
              key={i}
              x1={50 + r1 * Math.cos(a)}
              y1={50 + r1 * Math.sin(a)}
              x2={50 + 47.5 * Math.cos(a)}
              y2={50 + 47.5 * Math.sin(a)}
              className={i < lit ? 'tick tick--on' : 'tick'}
              strokeWidth={major ? 1.4 : 0.9}
            />
          );
        })}
      </svg>
    );
  }
  if (variant === 'glass') {
    const c = 2 * Math.PI * 44;
    return (
      <svg className="ring ring--arc" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" className="arc-track" />
        <circle
          cx="50"
          cy="50"
          r="44"
          className="arc-fill"
          strokeDasharray={`${f * c} ${c}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
    );
  }
  const lit = Math.round(f * 12);
  return (
    <div className="ring ring--blocks" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={i < lit ? 'block block--on' : 'block'} />
      ))}
    </div>
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
  const value = vital === 'bloodPressure' ? `${r.value}/${r.secondary}` : r.value.toFixed(def.decimals);
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
        {(Object.keys(readings) as VitalId[]).map((id) => (
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

export function WatchFace({ variant, astronautId, now }: { variant: Variant; astronautId: AstronautId; now: number }) {
  const { state } = useRoom();
  const store = useStore();
  const reduce = useReducedMotion();
  const [scope, animateCase] = useAnimate();
  const [info, setInfo] = useState<VitalId | null>(null);
  const astronaut = CREW_BY_ID[astronautId];
  const snap = snapshot(state ?? undefined, astronautId, now);
  const hr = snap.readings.heartRate;
  const alert = snap.connected ? snap.alert : undefined;
  const help = state?.help?.[astronautId];
  const status = snap.status;

  // Vibrate and shake when a new alert appears or escalates.
  const alertKey = alert ? `${alert.id}-${alert.level}` : '';
  const lastKey = useRef('');
  useEffect(() => {
    if (!alertKey || alertKey === lastKey.current || !alert) {
      lastKey.current = alertKey;
      return;
    }
    lastKey.current = alertKey;
    const pattern = VIBRATION[alert.level];
    if (pattern.length && 'vibrate' in navigator) navigator.vibrate(pattern);
    if (!reduce && alert.level >= 2 && scope.current) {
      animateCase(scope.current, { x: [0, -7, 7, -5, 5, -2, 0] }, { duration: 0.5 });
    }
  }, [alertKey, alert, reduce, scope, animateCase]);

  const fraction = (hr.value - 40) / (180 - 40);

  return (
    <div className={`watch v-${variant} ${levelClass(status)}`}>
      <div className="watch__case" ref={scope}>
        <div className="watch__screen">
          <Ring variant={variant} fraction={snap.connected ? fraction : 0} />

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
                    {VITALS[alert.id].label} {alert.value.toFixed(VITALS[alert.id].decimals)} {VITALS[alert.id].unit}
                  </span>
                  {routingFor(alert.level).cmo && <em>Medical officer notified</em>}
                </div>
                <div className="banner__buttons">
                  <button onClick={() => setInfo(alert.id)}>What to do</button>
                  <button onClick={() => store.acknowledge(astronautId, alert.id, alert.level)}>OK</button>
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
                  <ShortLabel text={VITALS[alert.id].short} /> {alert.value.toFixed(VITALS[alert.id].decimals)}
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
            {info && <InfoSheet key="sheet" readings={snap.readings} initial={info} onClose={() => setInfo(null)} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
