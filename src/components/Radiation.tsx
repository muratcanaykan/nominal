// Personal radiation dosimeter card (simulated): dose rate now, mission dose against the career limit, and what raises
// the rate. Shown on the crew member's own tablet; a one-line version goes to the medical officer and the simulation.

import { PROFILES, type AstronautId } from '../domain/crew';
import { CAREER_LIMIT_MSV, dose, type DoseStatus } from '../domain/radiation';
import type { RoomState } from '../domain/room';
import { radiationAdvisory, useSpaceWeather } from '../data/spaceWeather';

const STATUS_LEVEL: Record<DoseStatus, string> = { normal: 'lvl-0', elevated: 'lvl-1', high: 'lvl-2' };
const STATUS_LABEL: Record<DoseStatus, string> = { normal: 'Normal', elevated: 'Elevated', high: 'High' };

function Trefoil() {
  return (
    <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      {[90, 210, 330].map((a) => (
        <path
          key={a}
          transform={`rotate(${a - 90} 12 12)`}
          d="M12 9.3L9.4 4.8A8.4 8.4 0 0 1 14.6 4.8z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function useDose(id: AstronautId, state: RoomState | undefined, now: number) {
  const weather = useSpaceWeather();
  const advisory = radiationAdvisory(state, weather, now);
  return dose(state, id, now, advisory ? advisory.since : null);
}

export function RadiationCard({ id, state, now }: { id: AstronautId; state: RoomState | undefined; now: number }) {
  const d = useDose(id, state, now);
  const pct = d.careerShare * 100;
  return (
    <section className={`rad ${STATUS_LEVEL[d.status]}`} aria-label="Radiation dose">
      <header className="rad__head">
        <span className="rad__icon">
          <Trefoil />
        </span>
        <h3>Radiation dose</h3>
        <span className="rad__chip">{STATUS_LABEL[d.status]}</span>
      </header>
      <div className="rad__now">
        <strong>
          {d.rateUsvH < 100 ? d.rateUsvH.toFixed(1) : Math.round(d.rateUsvH)} <small>µSv/h now</small>
        </strong>
        <span>{d.reasons.length ? d.reasons.join(' · ') : 'Normal background for this mission location'}</span>
      </div>
      <div className="rad__bar" role="img" aria-label={`${pct.toFixed(1)} % of the career limit`}>
        <span style={{ width: `${Math.min(100, Math.max(1.5, pct))}%` }} />
      </div>
      <p className="rad__total">
        <strong>{d.missionMsv.toFixed(2)} mSv</strong> this mission · {pct.toFixed(1)} % of the {CAREER_LIMIT_MSV} mSv career limit
      </p>
      <p className="rad__note">
        Simulated personal dosimeter. Base rate for {PROFILES[state?.profile ?? 'lunar'].label.toLowerCase()} from published
        measurements; spacewalk and solar event factors are prototype assumptions.
      </p>
    </section>
  );
}

/** One line for the medical officer's crew cards and the simulation card. */
export function RadiationLine({ id, state, now }: { id: AstronautId; state: RoomState | undefined; now: number }) {
  const d = useDose(id, state, now);
  return (
    <p className={`rad-line ${STATUS_LEVEL[d.status]}`}>
      <Trefoil />
      <span>
        <strong>{d.missionMsv.toFixed(2)} mSv</strong> this mission · {d.rateUsvH < 100 ? d.rateUsvH.toFixed(1) : Math.round(d.rateUsvH)} µSv/h now
        {d.status !== 'normal' ? ` · ${STATUS_LABEL[d.status].toLowerCase()}` : ''}
      </span>
    </p>
  );
}
