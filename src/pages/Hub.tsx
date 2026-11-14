// Live demo: one mission seen from the crew's side. Pick a crew member to see what they can see: the shared cabin
// screen, the crew's watches and that person's own tablet. Scenarios and device links open as side panels.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { CabinScreen } from '../components/CabinScreen';
import { Qr } from '../components/Qr';
import { MissionControls, ScenarioControls } from '../components/ScenarioPanel';
import { SimSection } from '../components/SimSection';
import { Tablet } from '../components/Tablet';
import { WatchFace } from '../components/WatchFace';
import { DEMO_PIN } from '../components/MedicalView';
import { CREW, CREW_BY_ID, type AstronautId } from '../domain/crew';
import { locationLabel } from '../domain/locations';
import { canSee } from '../domain/roles';
import { useRoomId } from '../lib/RoomRoute';
import { useNow, useRoom } from '../lib/useRoom';
import { readViewer, saveViewer } from '../lib/viewer';

type DrawerId = 'scenarios' | 'devices';

function Drawer({ id, title, open, onClose, children }: { id: string; title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <aside id={id} className={`drawer${open ? ' is-open' : ''}`} aria-label={title} inert={!open}>
      <header className="drawer__head">
        <h2>{title}</h2>
        <button className="drawer__close" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
          ✕
        </button>
      </header>
      <div className="drawer__body">{children}</div>
    </aside>
  );
}

function DeviceLinks({ roomId }: { roomId: string }) {
  const origin = window.location.origin;
  const cards = [
    { key: 'cabin', title: 'Cabin screen', sub: 'Shared display · open it on a large screen', links: [{ label: 'Cabin screen', path: `/r/${roomId}/cabin` }] },
    ...CREW.map((a) => ({
      key: a.id,
      title: a.name,
      sub: a.cmo ? `Medical officer · tablet PIN ${DEMO_PIN}` : a.role,
      links: [
        { label: 'Watch', path: `/r/${roomId}/watch/${a.id}` },
        { label: 'Tablet', path: `/r/${roomId}/tablet/${a.id}` },
      ],
    })),
  ];
  return (
    <section className="drawer__section">
      <p className="drawer__hint">Scan a code with a phone to wear a watch, or open a screen on another computer. Every screen updates live.</p>
      <div className="device-list">
        {cards.map((c) => (
          <div key={c.key} className="device-card">
            <div className="device-card__text">
              <strong>{c.title}</strong>
              <span>{c.sub}</span>
            </div>
            <div className="device-card__codes">
              {c.links.map((l) => (
                <div key={l.path} className="device-code">
                  <Qr url={origin + l.path} label={`${c.title} ${l.label}`} />
                  <Link to={l.path} target="_blank" rel="noopener">
                    {l.label} ↗
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const roleLabel = (id: AstronautId) => (CREW_BY_ID[id].cmo ? 'Medical officer' : CREW_BY_ID[id].role);

/** "Who am I" button at the bottom left: choose the crew member whose devices the page shows. */
function ProfileSwitcher({ persona, onPick }: { persona: AstronautId; onPick: (id: AstronautId) => void }) {
  const { state } = useRoom();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const you = CREW_BY_ID[persona];
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={box} className={`profile${open ? ' is-open' : ''}`}>
      {open && (
        <div className="profile__panel" role="dialog" aria-labelledby="profile-title">
          <h2 id="profile-title" className="panel__title">
            View as
          </h2>
          <p className="profile__hint">Pick a crew member to see the mission through their devices.</p>
          <div className="profile__list" role="radiogroup" aria-labelledby="profile-title">
            {CREW.map((a) => (
              <button
                key={a.id}
                role="radio"
                aria-checked={persona === a.id}
                className={`profile__item${persona === a.id ? ' is-active' : ''}`}
                onClick={() => {
                  onPick(a.id);
                  setOpen(false);
                }}
              >
                <Avatar id={a.id} size={36} />
                <span className="profile__text">
                  <strong>{a.name}</strong>
                  <span>{roleLabel(a.id)}</span>
                  <small>{locationLabel(state, a.id)}</small>
                </span>
              </button>
            ))}
          </div>
          <h3 className="panel__title">{you.name} can see</h3>
          <ul className="profile__sees">
            {canSee(persona).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <button className="profile__button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        <Avatar id={persona} size={36} />
        <span className="profile__text">
          <small>Viewing as</small>
          <strong>{you.name}</strong>
          <span>{roleLabel(persona)}</span>
        </span>
        <span className="profile__chevron" aria-hidden="true">
          {open ? '▾' : '▴'}
        </span>
      </button>
    </div>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}`;
  return (
    <button
      className="btn-secondary"
      onClick={() => {
        navigator.clipboard?.writeText(link).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => undefined,
        );
      }}
    >
      {copied ? 'Link copied' : 'Copy room link'}
    </button>
  );
}

export function Hub() {
  const roomId = useRoomId();
  const now = useNow(250);
  const [persona, setPersona] = useState<AstronautId>(() => readViewer('02'));
  const [drawer, setDrawer] = useState<DrawerId | null>(null);
  const close = useCallback(() => setDrawer(null), []);
  const toggle = (d: DrawerId) => setDrawer((cur) => (cur === d ? null : d));
  const pick = (id: AstronautId) => {
    setPersona(id);
    saveViewer(id);
  };
  const you = CREW_BY_ID[persona];

  return (
    <div className={`mission${drawer ? ' has-drawer' : ''}`}>
      <main className="hub">
        <header className="hub__head">
          <div>
            <p className="hub__eyebrow">Nominal · Live demo · Simulated data</p>
            <h1 className="hub__title">
              Room <span className="hub__code">{roomId}</span>
            </h1>
          </div>
          <div className="hub__actions">
            <button
              className={`btn-primary${drawer === 'scenarios' ? ' is-active' : ''}`}
              aria-expanded={drawer === 'scenarios'}
              aria-controls="drawer-scenarios"
              onClick={() => toggle('scenarios')}
            >
              Scenarios
            </button>
            <button
              className={`btn-secondary${drawer === 'devices' ? ' is-active' : ''}`}
              aria-expanded={drawer === 'devices'}
              aria-controls="drawer-devices"
              onClick={() => toggle('devices')}
            >
              Open on devices
            </button>
            <CopyLink />
          </div>
        </header>

        <section className="stage" aria-labelledby="stage-sim">
          <div className="stage__head">
            <h2 id="stage-sim" className="panel__title">
              Mission simulation · 3D
            </h2>
            <span>Pick an astronaut, move them and change their readings. Every screen below follows.</span>
          </div>
          <SimSection viewer={persona} />
        </section>

        <section className="stage" aria-labelledby="stage-cabin">
          <div className="stage__head">
            <h2 id="stage-cabin" className="panel__title">
              Cabin screen
            </h2>
            <span>Shared display in the vehicle · everyone on board sees it · you act as {you.name}</span>
          </div>
          <CabinScreen now={now} viewer={persona} />
        </section>

        <section className="stage" aria-labelledby="stage-watches">
          <div className="stage__head">
            <h2 id="stage-watches" className="panel__title">
              Crew watches
            </h2>
            <span>In the vehicle, each watch is seen only by the person wearing it</span>
          </div>
          <div className="crew-watches">
            {CREW.map((a) => (
              <div key={a.id} className={`crew-watch${a.id === persona ? ' is-you' : ''}`}>
                <WatchFace astronautId={a.id} now={now} />
                <button className="crew-watch__label" aria-pressed={a.id === persona} onClick={() => pick(a.id)}>
                  <span className="crew-watch__name">
                    <Avatar id={a.id} size={22} />
                    <strong>{a.name}</strong>
                  </span>
                  <span>{a.id === persona ? 'You' : 'View as'}</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="stage" aria-labelledby="stage-tablet">
          <div className="stage__head">
            <h2 id="stage-tablet" className="panel__title">
              {you.name}'s tablet
            </h2>
            <span>
              {you.cmo
                ? 'Personal tablet · the crew medical view opens with the demo PIN'
                : you.commander
                  ? 'Personal tablet · crew duty status and own health on one screen'
                  : 'Personal tablet · only this crew member sees it'}
            </span>
          </div>
          <Tablet key={persona} astronautId={persona} />
        </section>
      </main>

      <ProfileSwitcher persona={persona} onPick={pick} />

      <Drawer id="drawer-scenarios" title="Scenarios" open={drawer === 'scenarios'} onClose={close}>
        <ScenarioControls key={persona} initialTarget={persona} />
        <MissionControls />
      </Drawer>
      <Drawer id="drawer-devices" title="Open on devices" open={drawer === 'devices'} onClose={close}>
        <DeviceLinks roomId={roomId} />
      </Drawer>
    </div>
  );
}
