// Alertness check on the crew member's own tablet: six targets after random waits; tap (or press Space) as soon as the
// target appears. The result is compared with the crew member's own baseline and shared with the medical officer.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AstronautId } from '../domain/crew';
import { FALSE_START_MS, latestReaction, RATING_LABELS, reactionAdvice, reactionSummary, TRIALS, WAIT_MS } from '../domain/reaction';
import type { RoomState } from '../domain/room';
import { useStore } from '../lib/useRoom';
import { formatAgo } from './bits';

type Phase = 'idle' | 'waiting' | 'go' | 'early' | 'shown';

const RATING_LEVEL = { alert: 'lvl-0', slower: 'lvl-1', tired: 'lvl-2' } as const;

export function ReactionTest({ id, state, now, sleepHours }: { id: AstronautId; state: RoomState | undefined; now: number; sleepHours: number | null }) {
  const store = useStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [trial, setTrial] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const times = useRef<number[]>([]);
  const early = useRef(0);
  const goAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const counter = useRef<HTMLSpanElement>(null);
  const area = useRef<HTMLButtonElement>(null);
  const result = latestReaction(state, id);

  const clear = () => window.clearTimeout(timer.current);
  useEffect(() => clear, []);

  const wait = () => {
    setPhase('waiting');
    const ms = WAIT_MS[0] + Math.random() * (WAIT_MS[1] - WAIT_MS[0]);
    timer.current = window.setTimeout(() => setPhase('go'), ms);
  };

  const start = () => {
    times.current = [];
    early.current = 0;
    setTrial(0);
    setLast(null);
    wait();
    window.setTimeout(() => area.current?.focus(), 0);
  };

  // The clock starts when the target is on screen; a running counter shows the time like the original test.
  useLayoutEffect(() => {
    if (phase !== 'go') return;
    goAt.current = performance.now();
    let raf = 0;
    const tick = () => {
      if (counter.current) counter.current.textContent = String(Math.round(performance.now() - goAt.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const respond = () => {
    if (phase === 'waiting') {
      clear();
      early.current += 1;
      setPhase('early');
      timer.current = window.setTimeout(wait, 900);
      return;
    }
    if (phase !== 'go') return;
    const rt = Math.round(performance.now() - goAt.current);
    if (rt < FALSE_START_MS) {
      early.current += 1;
      setPhase('early');
      timer.current = window.setTimeout(wait, 900);
      return;
    }
    times.current.push(rt);
    setLast(rt);
    setPhase('shown');
    const next = trial + 1;
    timer.current = window.setTimeout(() => {
      if (next >= TRIALS) {
        setPhase('idle');
        void store.submitReaction(id, times.current, early.current);
      } else {
        setTrial(next);
        wait();
      }
    }, 700);
  };

  const cancel = () => {
    clear();
    setPhase('idle');
  };

  const running = phase !== 'idle';

  return (
    <section className={`rt${result && !running ? ` ${RATING_LEVEL[result.rating]}` : ''}`} aria-labelledby={`rt-title-${id}`}>
      <header className="rt__head">
        <h3 id={`rt-title-${id}`}>Alertness check</h3>
        {result && !running && <span className="rt__chip">{RATING_LABELS[result.rating]}</span>}
      </header>

      {running ? (
        <>
          <button
            ref={area}
            className={`rt__area is-${phase}`}
            onPointerDown={(e) => {
              e.preventDefault();
              respond();
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!e.repeat) respond();
              }
            }}
            aria-live="assertive"
          >
            {phase === 'waiting' && <span className="rt__msg">Wait for the circle…</span>}
            {phase === 'go' && (
              <span className="rt__target">
                <span ref={counter}>0</span>
              </span>
            )}
            {phase === 'early' && <span className="rt__msg rt__msg--early">Too early: wait for the circle</span>}
            {phase === 'shown' && <span className="rt__msg rt__msg--time">{last} ms</span>}
          </button>
          <div className="rt__foot">
            <span>
              Target {Math.min(trial + 1, TRIALS)} of {TRIALS} · tap the area or press Space
            </span>
            <button className="btn-ghost" onClick={cancel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {result ? (
            <div className="rt__result">
              <strong>{reactionSummary(result, id)}</strong>
              <p>{reactionAdvice(result, sleepHours)}</p>
              <small>Last check {formatAgo(now - result.at)} ago · shared with the medical officer</small>
            </div>
          ) : (
            <p className="rt__intro">
              A 30-second reaction test, like the one used in spaceflight to spot fatigue before critical work. A circle
              appears after a random wait: tap as fast as you can.
            </p>
          )}
          <button className="btn-secondary rt__start" onClick={start}>
            {result ? 'Take it again' : 'Start the check'}
          </button>
        </>
      )}
    </section>
  );
}
