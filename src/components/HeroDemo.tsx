// Landing page example: a real watch in a local, simulated room loops through the alert levels while a ladder shows
// who is told at each one. Nothing here is synced or stored.

import { useEffect, useMemo } from 'react';
import type { AstronautId } from '../domain/crew';
import type { ScenarioId } from '../domain/scenarios';
import { snapshot } from '../domain/sim';
import type { Level } from '../domain/vitals';
import { MemoryBackend, RoomStore } from '../lib/store';
import { RoomContext, useNow, useRoom, useStore } from '../lib/useRoom';
import { LevelMark } from './bits';
import { WatchFace } from './WatchFace';

const SUBJECT: AstronautId = '02';

/** Nominal, then one continuous fall in blood oxygen that climbs through every level (about 5 s each), then a pause. */
const PHASES: { scenario: ScenarioId; ms: number; rampMs?: number }[] = [
  { scenario: 'nominal', ms: 5000 },
  { scenario: 'slowSpo2', ms: 30_000, rampMs: 24_000 },
];

const RUNGS: { level: Level; name: string; who: string; text: string }[] = [
  { level: 0, name: 'Nominal', who: 'Values on the watch', text: 'Nobody else needs to know.' },
  { level: 1, name: 'Caution', who: 'Own watch only', text: 'Yellow and a light vibration. Small changes stay private.' },
  { level: 2, name: 'Warning', who: '+ Medical officer', text: "Orange, strong vibration, the medical officer's tablet is told." },
  { level: 3, name: 'Critical', who: '+ Whole crew and Earth', text: 'Red. The cabin screen calls the crew; flight surgeons follow with the signal delay.' },
];

function Stage() {
  const store = useStore();
  const { state } = useRoom();
  const now = useNow(250);

  useEffect(() => {
    let i = 0;
    let t: number;
    const step = () => {
      void store.runScenario(SUBJECT, PHASES[i].scenario, PHASES[i].rampMs);
      t = window.setTimeout(() => {
        i = (i + 1) % PHASES.length;
        step();
      }, PHASES[i].ms);
    };
    step();
    return () => window.clearTimeout(t);
  }, [store]);

  const s = snapshot(state ?? undefined, SUBJECT, now);
  const level = s.status === 'nodata' ? 0 : s.status;

  return (
    <div className="hero-stage">
      <div className="hero-stage__watch" aria-hidden="true">
        <span className="hero-stage__orbit" />
        <span className="hero-stage__orbit hero-stage__orbit--outer" />
        <WatchFace astronautId={SUBJECT} now={now} quiet />
      </div>
      <div className="hero-stage__side">
        <p className="hero-stage__label">Who is told · live example</p>
        <ol className="hero-ladder">
          {RUNGS.map((r) => (
            <li key={r.level} className={`hero-ladder__rung lvl-${r.level}${level >= r.level ? ' is-on' : ''}${level === r.level ? ' is-now' : ''}`}>
              <LevelMark status={r.level} />
              <div>
                <strong>
                  {r.name} <span>· {r.who}</span>
                </strong>
                <p>{r.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="hero-stage__note">A simulated spacewalker, looping through the four alert levels.</p>
      </div>
    </div>
  );
}

export function HeroDemo() {
  // In memory only: nothing to close when the page leaves.
  const store = useMemo(() => new RoomStore(new MemoryBackend()), []);
  return (
    <RoomContext.Provider value={store}>
      <Stage />
    </RoomContext.Provider>
  );
}
