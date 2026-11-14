// Controls beside the 3D simulation: pick a crew member, move them, and change their readings with sliders.
// Slider changes are shared through the room, so every open screen follows.

import { useEffect, useRef, useState } from 'react';
import { CREW, CREW_BY_ID, type AstronautId } from '../domain/crew';
import { isSuited, LOCATION_IDS, LOCATIONS, locationOf } from '../domain/locations';
import { snapshot, type Reading } from '../domain/sim';
import { LEVEL_NAMES, VITALS, type VitalId } from '../domain/vitals';
import { useNow, useRoom, useStore } from '../lib/useRoom';
import { levelClass, ShortLabel } from './bits';

interface SliderDef {
  vital: VitalId;
  min: number;
  max: number;
  step: number;
}

const BODY_SLIDERS: SliderDef[] = [
  { vital: 'heartRate', min: 30, max: 200, step: 1 },
  { vital: 'spo2', min: 75, max: 100, step: 1 },
  { vital: 'bodyTemp', min: 34, max: 41, step: 0.1 },
  { vital: 'glucose', min: 30, max: 400, step: 1 },
];

const SUIT_SLIDERS: SliderDef[] = [
  { vital: 'fingerTempL', min: 4, max: 40, step: 0.5 },
  { vital: 'helmetCO2', min: 0, max: 20, step: 0.5 },
  { vital: 'helmetWater', min: 0, max: 200, step: 5 },
  { vital: 'shoulderR', min: 0, max: 20, step: 0.5 },
];

function VitalSlider({ id, def, reading, disabled }: { id: AstronautId; def: SliderDef; reading: Reading; disabled: boolean }) {
  const store = useStore();
  const [draft, setDraft] = useState<number | null>(null);
  const commitTimer = useRef<number | undefined>(undefined);
  const releaseTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(commitTimer.current);
      window.clearTimeout(releaseTimer.current);
    },
    [],
  );
  const v = VITALS[def.vital];
  const shown = draft ?? Math.min(def.max, Math.max(def.min, reading.value));
  const level = disabled ? 'nodata' : reading.level;
  return (
    <label className={`sim-slider ${levelClass(level)}`}>
      <span className="sim-slider__head">
        <span className="sim-slider__name">
          <ShortLabel text={v.short} /> <span>{v.label}</span>
        </span>
        <strong>
          {disabled ? '—' : shown.toFixed(v.decimals)} <small>{v.unit}</small>
        </strong>
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={shown}
        disabled={disabled}
        aria-valuetext={`${shown.toFixed(v.decimals)} ${v.unit}, ${LEVEL_NAMES[reading.level]}`}
        onChange={(e) => {
          const value = Number(e.target.value);
          setDraft(value);
          window.clearTimeout(commitTimer.current);
          window.clearTimeout(releaseTimer.current);
          commitTimer.current = window.setTimeout(() => {
            store.setVital(id, def.vital, value);
            releaseTimer.current = window.setTimeout(() => setDraft(null), 1800);
          }, 200);
        }}
      />
    </label>
  );
}

export function SimPanel({ target, onTarget }: { target: AstronautId | null; onTarget: (id: AstronautId | null) => void }) {
  const store = useStore();
  const { state } = useRoom();
  const now = useNow(500);
  const st = state ?? undefined;

  return (
    <aside className="sim-panel" aria-label="Simulation controls">
      <div className="segmented sim-panel__crew" role="radiogroup" aria-label="Crew member in the simulation">
        {CREW.map((c) => (
          <button key={c.id} role="radio" aria-checked={target === c.id} className={target === c.id ? 'is-active' : ''} onClick={() => onTarget(c.id)}>
            {c.callsign}
          </button>
        ))}
      </div>

      {!target ? (
        <div className="sim-panel__empty">
          <p>Select an astronaut in the 3D view or above.</p>
          <p>Then move them between the modules and outside, and change their readings with sliders. The cabin screen, the watches and the tablets update live.</p>
        </div>
      ) : (
        (() => {
          const a = CREW_BY_ID[target];
          const s = snapshot(st, target, now);
          const where = locationOf(st, target);
          const suited = isSuited(st, target);
          return (
            <>
              <div className={`sim-panel__who ${levelClass(s.status)}`}>
                <strong>{a.name}</strong>
                <span>
                  {LOCATIONS[where].label} · {s.status === 'nodata' ? 'No data' : LEVEL_NAMES[s.worst]}
                </span>
                <button className="sim-panel__overview" onClick={() => onTarget(null)}>
                  Overview
                </button>
              </div>

              <h3 className="panel__title">Location</h3>
              <div className="segmented" role="radiogroup" aria-label={`Location of ${a.name}`}>
                {LOCATION_IDS.map((l) => (
                  <button key={l} role="radio" aria-checked={where === l} className={where === l ? 'is-active' : ''} onClick={() => store.setLocation(target, l)}>
                    {LOCATIONS[l].short}
                  </button>
                ))}
              </div>

              <h3 className="panel__title">Vital signs</h3>
              {BODY_SLIDERS.map((d) => (
                <VitalSlider key={`${target}-${d.vital}`} id={target} def={d} reading={s.readings[d.vital]} disabled={!s.connected} />
              ))}

              <h3 className="panel__title">Suit sensors</h3>
              {!suited && <p className="sim-panel__hint">Only in the suit. Move {a.name} to the airlock or outside.</p>}
              {SUIT_SLIDERS.map((d) => (
                <VitalSlider key={`${target}-${d.vital}`} id={target} def={d} reading={s.readings[d.vital]} disabled={!suited || !s.connected} />
              ))}

              <div className="chip-row">
                <button className="chip-btn lvl-0" onClick={() => store.runScenario(target, 'nominal')}>
                  Back to nominal
                </button>
              </div>
            </>
          );
        })()
      )}
    </aside>
  );
}
