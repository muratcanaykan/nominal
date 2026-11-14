// Full-screen pages for a single device: one astronaut's watch or tablet, or the shared cabin screen.

import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { CabinScreen } from '../components/CabinScreen';
import { Tablet } from '../components/Tablet';
import { WatchFace } from '../components/WatchFace';
import { CREW, CREW_BY_ID, type AstronautId } from '../domain/crew';
import type { TabletView } from '../domain/roles';
import { useRoomId } from '../lib/RoomRoute';
import { useNow } from '../lib/useRoom';
import { readViewer, saveViewer } from '../lib/viewer';

function ScreenNav({ children }: { children?: React.ReactNode }) {
  const roomId = useRoomId();
  return (
    <nav className="screen-nav">
      <Link to={`/r/${roomId}`}>← Live demo</Link>
      <span className="screen-nav__room">Room {roomId}</span>
      {children}
    </nav>
  );
}

function NoCrew({ id }: { id: string }) {
  const roomId = useRoomId();
  return (
    <div className="gate">
      <h1>No crew member {id}</h1>
      <Link className="btn-secondary" to={`/r/${roomId}`}>
        Back to the live demo
      </Link>
    </div>
  );
}

function CrewSwitch({ current, device }: { current: AstronautId; device: 'watch' | 'tablet' }) {
  const roomId = useRoomId();
  return (
    <nav className="crew-switch" aria-label="Switch crew member">
      {CREW.map((c) => (
        <Link key={c.id} className={c.id === current ? 'is-active' : ''} to={`/r/${roomId}/${device}/${c.id}`}>
          {c.callsign}
        </Link>
      ))}
    </nav>
  );
}

export function WatchPage() {
  const { astronautId = '' } = useParams();
  const now = useNow(250);
  const a = CREW_BY_ID[astronautId as AstronautId];
  if (!a) return <NoCrew id={astronautId} />;
  return (
    <main className="screen-page screen-page--watch">
      <ScreenNav />
      <WatchFace astronautId={a.id} now={now} />
      <p className="screen-page__meta">
        {a.name} · {a.role} · Simulated data
      </p>
      <CrewSwitch current={a.id} device="watch" />
    </main>
  );
}

const VIEW_PARAMS: Record<string, TabletView> = { crew: 'crewStatus', medical: 'crewMedical' };

export function TabletPage() {
  const { astronautId = '' } = useParams();
  const [params] = useSearchParams();
  const a = CREW_BY_ID[astronautId as AstronautId];
  if (!a) return <NoCrew id={astronautId} />;
  return (
    <main className="screen-page screen-page--tablet">
      <ScreenNav>
        <CrewSwitch current={a.id} device="tablet" />
      </ScreenNav>
      <Tablet key={a.id} astronautId={a.id} initialView={VIEW_PARAMS[params.get('view') ?? '']} />
    </main>
  );
}

/** The old medical officer link now opens the medical officer's tablet. */
export function CmoRedirect() {
  const roomId = useRoomId();
  const cmo = CREW.find((c) => c.cmo) ?? CREW[0];
  return <Navigate to={`/r/${roomId}/tablet/${cmo.id}?view=medical`} replace />;
}

export function CabinPage() {
  const now = useNow(250);
  const [viewer, setViewer] = useState<AstronautId>(() => readViewer('04'));
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
              saveViewer(v);
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
      <CabinScreen now={now} viewer={viewer} />
    </main>
  );
}
