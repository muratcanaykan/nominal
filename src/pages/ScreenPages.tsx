// Full-screen pages for a single device: one astronaut's watch, or the shared cabin screen.

import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CabinScreen } from '../components/CabinScreen';
import { WatchFace } from '../components/WatchFace';
import { CREW, CREW_BY_ID, type AstronautId } from '../domain/crew';
import { useRoomId } from '../lib/RoomRoute';
import { useNow } from '../lib/useRoom';
import { useStyledPath, useVariant } from '../lib/variant';

function ScreenNav({ children }: { children?: React.ReactNode }) {
  const roomId = useRoomId();
  const styled = useStyledPath();
  return (
    <nav className="screen-nav">
      <Link to={styled(`/r/${roomId}`)}>← Demo control</Link>
      <span className="screen-nav__room">Room {roomId}</span>
      {children}
    </nav>
  );
}

export function WatchPage() {
  const { astronautId = '' } = useParams();
  const roomId = useRoomId();
  const styled = useStyledPath();
  const variant = useVariant();
  const now = useNow(250);
  const a = CREW_BY_ID[astronautId as AstronautId];
  if (!a) {
    return (
      <div className="gate">
        <h1>No crew member {astronautId}</h1>
        <Link className="btn-secondary" to={styled(`/r/${roomId}`)}>
          Back to demo control
        </Link>
      </div>
    );
  }
  return (
    <main className="screen-page screen-page--watch">
      <ScreenNav />
      <WatchFace variant={variant} astronautId={a.id} now={now} />
      <p className="screen-page__meta">
        {a.name} · {a.role} · Simulated data
      </p>
      <nav className="crew-switch" aria-label="Switch crew member">
        {CREW.map((c) => (
          <Link key={c.id} className={c.id === a.id ? 'is-active' : ''} to={styled(`/r/${roomId}/watch/${c.id}`)}>
            {c.callsign}
          </Link>
        ))}
      </nav>
    </main>
  );
}

const VIEWER_KEY = 'nominal:viewer';

function readViewer(): AstronautId {
  try {
    const v = localStorage.getItem(VIEWER_KEY);
    if (v && v in CREW_BY_ID) return v as AstronautId;
  } catch {
    /* storage unavailable */
  }
  return '04';
}

export function CabinPage() {
  const variant = useVariant();
  const now = useNow(250);
  const [viewer, setViewer] = useState<AstronautId>(readViewer);
  return (
    <main className="screen-page screen-page--cabin">
      <ScreenNav>
        <label className="screen-nav__viewer">
          Responding as
          <select
            id="cabin-viewer"
            value={viewer}
            onChange={(e) => {
              const v = e.target.value as AstronautId;
              setViewer(v);
              try {
                localStorage.setItem(VIEWER_KEY, v);
              } catch {
                /* storage unavailable */
              }
            }}
          >
            {CREW.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </ScreenNav>
      <CabinScreen variant={variant} now={now} viewer={viewer} />
    </main>
  );
}
