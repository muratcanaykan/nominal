// Details for one body region: its live readings and what it does, how spaceflight affects it, how it is measured,
// when to see the medical officer and how to prevent problems.

import { useEffect } from 'react';
import { REGION_LABELS, type BodyRegion } from '../domain/body';
import { regionStates } from '../domain/bodymap';
import { isSuited } from '../domain/locations';
import { REGION_INFO } from '../domain/regionInfo';
import type { RoomState } from '../domain/room';
import type { Snapshot } from '../domain/sim';
import { LEVEL_NAMES, VITALS } from '../domain/vitals';
import { levelClass } from './bits';
import { readingNote, readingValue } from './health';

export function RegionDetails({
  region,
  s,
  state,
  onClose,
}: {
  region: BodyRegion;
  s: Snapshot;
  state: RoomState | undefined;
  onClose: () => void;
}) {
  const info = REGION_INFO[region];
  const live = regionStates(s, state)[region];
  const level = live?.level ?? 0;
  return (
    <section className={`region ${levelClass(s.connected ? level : 'nodata')}`} aria-label={REGION_LABELS[region]}>
      <header className="region__head">
        <div>
          <span className="region__eyebrow">Body region</span>
          <h3>{REGION_LABELS[region]}</h3>
        </div>
        {level > 0 && <span className="region__badge">{LEVEL_NAMES[level]}</span>}
        <button className="region__close" onClick={onClose} aria-label="Close region details">
          ✕
        </button>
      </header>

      {!s.connected ? (
        <p className="region__none">No data from the sensors.</p>
      ) : live && live.readings.length > 0 ? (
        <ul className="region__now">
          {live.readings.map((r) => {
            const note = readingNote(r, state, s.astronautId);
            return (
              <li key={r.id} className={levelClass(r.level)}>
                <span>
                  {VITALS[r.id].label}
                  {note && <em> · {note}</em>}
                </span>
                <strong>
                  {readingValue(r)} <small>{VITALS[r.id].unit}</small>
                </strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="region__none">
          No live sensor on this region{isSuited(state, s.astronautId) ? '.' : ' right now. Suit sensors report only while suited.'}
        </p>
      )}

      <dl className="region__info">
        <div>
          <dt>What it does</dt>
          <dd>{info.function}</dd>
        </div>
        <div>
          <dt>In spaceflight</dt>
          <dd>{info.spaceflight}</dd>
        </div>
        <div>
          <dt>How it is measured</dt>
          <dd>{info.measured}</dd>
        </div>
        <div>
          <dt>When to see the medical officer</dt>
          <dd>{info.exam}</dd>
        </div>
        <div>
          <dt>Prevention</dt>
          <dd>{info.prevention}</dd>
        </div>
      </dl>
    </section>
  );
}

/** The same details in a window over the page, for small body maps. */
export function RegionSheet(props: { region: BodyRegion; s: Snapshot; state: RoomState | undefined; onClose: () => void }) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      root.style.overflow = previous;
    };
  }, [onClose]);
  return (
    <div
      className="region-sheet"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="region-sheet__inner">
        <RegionDetails {...props} />
      </div>
    </div>
  );
}
