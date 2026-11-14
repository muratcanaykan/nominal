// A simple person icon for each crew member: their own colour, plus a star for the commander and a cross for the
// medical officer. Colours avoid the alert colours (green, yellow, orange, red) so they are never read as a status.

import type { CSSProperties } from 'react';
import { CREW_BY_ID, type AstronautId } from '../domain/crew';

export const CREW_COLORS: Record<AstronautId, string> = {
  '01': '#a78bfa',
  '02': '#60a5fa',
  '03': '#e879f9',
  '04': '#d6b98c',
};

export function Avatar({ id, size = 28 }: { id: AstronautId; size?: number }) {
  const a = CREW_BY_ID[id];
  return (
    <span className="avatar" style={{ '--avatar': CREW_COLORS[id], width: size, height: size } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 32 32" className="avatar__person">
        <circle cx="16" cy="12.5" r="5.6" fill="currentColor" />
        <path d="M5.5 28.5c1.3-5.6 5.4-8.6 10.5-8.6s9.2 3 10.5 8.6" fill="currentColor" />
      </svg>
      {(a.commander || a.cmo) && (
        <svg viewBox="0 0 16 16" className="avatar__badge">
          <circle cx="8" cy="8" r="8" className="avatar__badge-bg" />
          {a.commander ? (
            <path d="M8 2.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 10.8l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="currentColor" />
          ) : (
            <path d="M6.6 3.5h2.8v3.1h3.1v2.8H9.4v3.1H6.6V9.4H3.5V6.6h3.1z" fill="currentColor" />
          )}
        </svg>
      )}
    </span>
  );
}
