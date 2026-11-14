// Guided tour for judges and first-time visitors: one health event played live, from a single sensor to the whole
// crew, in about a minute. Each step lights up the screen that changes and says who is told. It also works as the
// script for the demo video.

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CREW_BY_ID, PROFILES, type AstronautId } from '../domain/crew';
import type { Told } from '../domain/narrator';
import { snapshot } from '../domain/sim';
import { useRoom, useStore } from '../lib/useRoom';
import { requestTablet } from '../lib/tabletRequest';
import { formatDelay } from './bits';
import { markUnlocked } from './MedicalView';
import { ToldRow } from './Narrator';

/** The tour follows Okafor on a spacewalk; Lindqvist is the medical officer. */
const SUBJECT: AstronautId = '02';
const CMO: AstronautId = '03';
/** Blood oxygen falls from baseline to critical in about 45 s (the "Oxygen slowly dropping" scenario, faster). */
const RAMP_MS = 60_000;
/** A step moves on by itself after this long even if the event has not got there (for example after a manual change). */
const MAX_STEP_MS = 40_000;

interface Ctx {
  level: number;
  delay: string;
  profile: string;
}

interface Step {
  target?: () => Element | null;
  title: string;
  body: (c: Ctx) => string;
  told?: Told[];
  /** Whose devices the page shows during the step. */
  persona?: AstronautId;
  enter?: () => void;
  minMs: number;
  ready?: (c: Ctx) => boolean;
}

const section = (id: string) => () => document.getElementById(id)?.closest('section') ?? null;
const subject = CREW_BY_ID[SUBJECT];
const cmo = CREW_BY_ID[CMO];
const last = (name: string) => name.split(' ').slice(-1)[0];

const STEPS: Step[] = [
  {
    target: section('stage-sim'),
    title: 'A crew of four',
    body: () =>
      `${CREW_BY_ID['01'].name} is in the habitat, ${cmo.name} in the lab, ${CREW_BY_ID['04'].name} in the airlock and ${subject.name} outside on a spacewalk. Each astronaut glows in their own alert level; pulses show data travelling to the vehicle and to Earth.`,
    persona: SUBJECT,
    minMs: 9000,
  },
  {
    target: () => document.getElementById(`watch-${SUBJECT}`),
    title: 'It starts on one wrist',
    body: () =>
      `${last(subject.name)}'s blood oxygen begins to drift down during the spacewalk. The watch compares every reading with ${last(subject.name)}'s own baseline. Nothing is out of range yet, so nobody is alerted.`,
    persona: SUBJECT,
    minMs: 6000,
    ready: (c) => c.level >= 1,
  },
  {
    target: () => document.getElementById(`watch-${SUBJECT}`),
    title: 'Level 1 · Caution',
    body: () =>
      `The watch turns yellow with a light vibration. Small changes stay private: nobody else is told. Because the value keeps falling, the watch also says how soon the next level comes, so ${last(subject.name)} can act first.`,
    told: ['watch'],
    persona: SUBJECT,
    minMs: 6000,
    ready: (c) => c.level >= 2,
  },
  {
    target: () => document.getElementById(`cmo-card-${SUBJECT}`) ?? section('stage-tablet')(),
    title: 'Level 2 · Warning',
    body: () =>
      `The watch turns orange and vibrates strongly. ${cmo.name}, the crew medical officer, is notified and sees ${last(subject.name)}'s details on the medical tablet (demo PIN 2468). The commander sees only "Medical review": no values, no reason.`,
    told: ['watch', 'cmo'],
    persona: CMO,
    enter: () => {
      markUnlocked();
      window.setTimeout(() => requestTablet(SUBJECT), 300);
    },
    minMs: 7000,
    ready: (c) => c.level >= 3,
  },
  {
    target: section('stage-cabin'),
    title: 'Level 3 · Critical',
    body: (c) =>
      `Now the whole crew has to act. The shared cabin screen shows an event card: who, where and a response checklist anyone on board can tick off. Flight surgeons on Earth are told after a ${c.delay} signal delay, so the crew does not wait for them. Routine values never appear on this screen.`,
    told: ['watch', 'cmo', 'cabin', 'earth'],
    minMs: 11_000,
  },
];

function useTargetRect(target: (() => Element | null) | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const read = () => {
      const r = target()?.getBoundingClientRect() ?? null;
      setRect((cur) =>
        cur && r && Math.abs(cur.top - r.top) < 1 && Math.abs(cur.left - r.left) < 1 && Math.abs(cur.width - r.width) < 1 && Math.abs(cur.height - r.height) < 1
          ? cur
          : r,
      );
    };
    read();
    const t = window.setInterval(read, 120);
    window.addEventListener('scroll', read, { passive: true, capture: true });
    window.addEventListener('resize', read);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('scroll', read, { capture: true });
      window.removeEventListener('resize', read);
    };
  }, [target]);
  return rect;
}

function reveal(el: Element | null) {
  if (!el) return;
  // On phones the tour card covers the lower part of the screen, so the highlighted screen goes to the top.
  const top = window.innerWidth <= 640 || el.getBoundingClientRect().height > window.innerHeight * 0.7;
  el.scrollIntoView({ behavior: 'smooth', block: top ? 'start' : 'center' });
}

export function Tour({ onPersona, onClose }: { onPersona: (id: AstronautId) => void; onClose: () => void }) {
  const store = useStore();
  const { state } = useRoom();
  /** -1 = intro, STEPS.length = finished. */
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [stepAt, setStepAt] = useState(Date.now());
  const [, setTick] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const profile = PROFILES[state?.profile ?? 'lunar'];
  const ctx = (): Ctx => {
    const s = snapshot(stateRef.current ?? undefined, SUBJECT, store.now());
    return { level: s.status === 'nodata' ? 0 : s.status, delay: formatDelay(profile.earthDelayMs), profile: profile.label.toLowerCase() };
  };

  const go = useCallback(
    (i: number) => {
      setStep(i);
      setStepAt(Date.now());
      const s = STEPS[i];
      if (!s) return;
      if (s.persona) onPersona(s.persona);
      s.enter?.();
      window.setTimeout(() => reveal(s.target?.() ?? null), s.persona === CMO ? 120 : 30);
    },
    [onPersona],
  );

  const start = useCallback(async () => {
    setPlaying(true);
    onPersona(SUBJECT);
    // A fresh room (mission clock included), so no scheduled mood check-in covers the watches during the tour.
    await store.create(stateRef.current?.profile ?? 'lunar');
    await store.runScenario(SUBJECT, 'slowSpo2', RAMP_MS);
    go(0);
  }, [store, onPersona, go]);

  // Auto-advance: each step waits for its moment in the event and a minimum reading time.
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const t = window.setInterval(() => {
      setTick((n) => n + 1);
      if (!playing) return;
      const s = STEPS[step];
      const elapsed = Date.now() - stepAt;
      if (elapsed >= MAX_STEP_MS || (elapsed >= s.minMs && (!s.ready || s.ready(ctx())))) go(step + 1);
    }, 250);
    return () => window.clearInterval(t);
    // ctx reads live state through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepAt, playing, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && step >= 0 && step < STEPS.length) go(step + 1);
      else if (e.key === 'ArrowLeft' && step > 0 && step <= STEPS.length) go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, go, onClose]);

  const current = step >= 0 ? STEPS[step] : undefined;
  const rect = useTargetRect(current?.target);
  const c = ctx();
  const centred = !current;
  const progress = current ? Math.min(1, (Date.now() - stepAt) / current.minMs) : 0;

  return (
    <div className={`tour${centred ? ' is-centred' : ''}`}>
      {rect ? (
        <div
          className="tour__spot"
          style={{ top: rect.top - 10, left: rect.left - 10, width: rect.width + 20, height: rect.height + 20 }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour__dim" aria-hidden="true" />
      )}
      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          className="tour__card"
          role="dialog"
          aria-modal="false"
          aria-labelledby="tour-title"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {step === -1 && (
            <>
              <p className="tour__eyebrow">Guided tour · about 1 minute</p>
              <h2 id="tour-title">Nominal in one minute</h2>
              <p className="tour__text">
                Follow one health event on a {c.profile}, from a single sensor to the whole crew. The tour resets this demo
                room and plays the event live. All data is simulated.
              </p>
              <div className="tour__actions">
                <button className="btn-primary" onClick={start} autoFocus>
                  Start the tour
                </button>
                <button className="btn-secondary" onClick={onClose}>
                  Not now
                </button>
              </div>
            </>
          )}

          {current && (
            <>
              <p className="tour__eyebrow">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 id="tour-title">{current.title}</h2>
              <p className="tour__text">{current.body(c)}</p>
              {current.told && <ToldRow told={current.told} />}
              <div className="tour__bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <div className="tour__actions">
                <button className="tour__btn" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous step">
                  ←
                </button>
                <button className="tour__btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause the tour' : 'Play the tour'}>
                  {playing ? '❚❚' : '▶'}
                </button>
                <button className="tour__btn" onClick={() => go(step + 1)} aria-label="Next step">
                  →
                </button>
                <button className="tour__exit" onClick={onClose}>
                  Exit tour
                </button>
              </div>
            </>
          )}

          {step === STEPS.length && (
            <>
              <p className="tour__eyebrow">Tour complete</p>
              <h2 id="tour-title">Personal first, crew only when needed</h2>
              <p className="tour__text">
                Each alert reached only the people who needed it. Now explore: Scenarios play other events (fever, low
                glucose, suit sensors, a lost signal), the profile button at the bottom left changes whose devices you see,
                and Open on devices puts any screen on a phone. The narrator keeps explaining what happens.
              </p>
              <div className="tour__actions">
                <button className="btn-primary" onClick={onClose} autoFocus>
                  Explore
                </button>
                <button className="btn-secondary" onClick={start}>
                  Replay
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    void store.resetDemo();
                    onClose();
                  }}
                >
                  Reset demo
                </button>
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
