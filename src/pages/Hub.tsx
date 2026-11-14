// Live demo: one mission seen from the crew's side. Pick a crew member to see what they can see: the shared cabin
// screen, the crew's watches and that person's own tablet. Scenarios and device links open as side panels.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CabinScreen } from '../components/CabinScreen';
import { Qr } from '../components/Qr';
import { Tablet } from '../components/Tablet';
import { WatchFace } from '../components/WatchFace';
import { DEMO_PIN } from '../components/MedicalView';
import { CREW, CREW_BY_ID, PROFILES, type AstronautId, type ProfileId } from '../domain/crew';
import { isSuited, LOCATION_IDS, LOCATIONS, locationLabel, locationOf } from '../domain/locations';
import { canSee } from '../domain/roles';
import { activeScenario, type ScenarioId } from '../domain/scenarios';
import { useRoomId } from '../lib/RoomRoute';
import { useNow, useRoom, useStore } from '../lib/useRoom';
import { readViewer, saveViewer } from '../lib/viewer';

const SCENARIO_BUTTONS: { id: ScenarioId; label: string; level: string }[] = [
  { id: 'nominal', label: 'Nominal', level: 'lvl-0' },
  { id: 'caution', label: 'High heart rate', level: 'lvl-1' },
  { id: 'lowGlucose', label: 'Low glucose', level: 'lvl-1' },
  { id: 'warning', label: 'Falling SpO₂', level: 'lvl-2' },
  { id: 'fever', label: 'Fever', level: 'lvl-2' },
  { id: 'critical', label: 'Hypoxia', level: 'lvl-3' },
  { id: 'nodata', label: 'Sensor offline', level: 'lvl-nodata' },
];

const SUIT_BUTTONS: { id: ScenarioId; label: string; level: string }[] = [
  { id: 'coldHand', label: 'Cold left hand', level: 'lvl-1' },
  { id: 'shoulderPressure', label: 'Shoulder pressure point', level: 'lvl-1' },
  { id: 'helmetCO2', label: 'Helmet CO₂ rising', level: 'lvl-2' },
  { id: 'helmetWater', label: 'Water in helmet', level: 'lvl-3' },
];

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

function ScenarioControls({ initialTarget }: { initialTarget: AstronautId }) {
  const store = useStore();
  const { state } = useRoom();
  const [target, setTarget] = useState<AstronautId>(initialTarget);
  const a = CREW_BY_ID[target];
  const active = activeScenario(state, target);
  const help = state?.help?.[target];
  const where = locationOf(state, target);
  const suited = isSuited(state, target);
  const chip = (b: { id: ScenarioId; label: string; level: string }, disabled = false) => (
    <button
      key={b.id}
      className={`chip-btn ${b.level}${active === b.id ? ' is-active' : ''}`}
      aria-pressed={active === b.id}
      disabled={disabled}
      onClick={() => store.runScenario(target, b.id)}
    >
      {b.label}
    </button>
  );
  return (
    <section className="drawer__section">
      <h3 className="panel__title">Crew member</h3>
      <div className="segmented" role="radiogroup" aria-label="Crew member for the scenario">
        {CREW.map((c) => (
          <button key={c.id} role="radio" aria-checked={target === c.id} className={target === c.id ? 'is-active' : ''} onClick={() => setTarget(c.id)}>
            {c.callsign}
          </button>
        ))}
      </div>
      <p className="drawer__hint">
        {a.name} · {a.role} · {locationLabel(state, target)}
      </p>
      <h3 className="panel__title">Location</h3>
      <div className="segmented" role="radiogroup" aria-label={`Location of ${a.name}`}>
        {LOCATION_IDS.map((l) => (
          <button key={l} role="radio" aria-checked={where === l} className={where === l ? 'is-active' : ''} onClick={() => store.setLocation(target, l)}>
            {LOCATIONS[l].short}
          </button>
        ))}
      </div>
      <h3 className="panel__title">Readings</h3>
      <div className="chip-row">{SCENARIO_BUTTONS.map((b) => chip(b))}</div>
      <h3 className="panel__title">Suit sensors</h3>
      {!suited && <p className="drawer__hint">Suit sensors report only in the suit. Move {a.name} to the airlock or outside first.</p>}
      <div className="chip-row">{SUIT_BUTTONS.map((b) => chip(b, !suited))}</div>
      <h3 className="panel__title">From the watch</h3>
      <div className="chip-row">
        {chip({ id: 'kneePain', label: 'Knee pain report', level: suited ? 'lvl-2' : 'lvl-1' })}
        <button
          className={`chip-btn lvl-3${help ? ' is-active' : ''}`}
          aria-pressed={!!help}
          onClick={() => (help ? store.cancelHelp(target) : store.requestHelp(target))}
        >
          {help ? 'Cancel help call' : 'Help call'}
        </button>
        <button className="chip-btn" onClick={() => store.askMood(target)}>
          Ask mood
        </button>
      </div>
    </section>
  );
}

function MissionControls() {
  const store = useStore();
  const { state } = useRoom();
  const [confirmReset, setConfirmReset] = useState(false);
  const profile = state?.profile ?? 'lunar';
  const solar = !!state?.spaceWeather?.sepAt;
  return (
    <section className="drawer__section">
      <h3 className="panel__title">Mission</h3>
      <div className="segmented" role="radiogroup" aria-label="Mission location">
        {(Object.keys(PROFILES) as ProfileId[]).map((p) => (
          <button key={p} role="radio" aria-checked={profile === p} className={profile === p ? 'is-active' : ''} onClick={() => store.setProfile(p)}>
            {PROFILES[p].label}
          </button>
        ))}
      </div>
      <div className="chip-row">
        <button className={`chip-btn lvl-2${solar ? ' is-active' : ''}`} aria-pressed={solar} onClick={() => store.simulateSolarEvent(!solar)}>
          {solar ? 'End solar particle event' : 'Simulate solar particle event'}
        </button>
        {confirmReset ? (
          <span className="reset-confirm">
            Clear all scenarios and alerts?
            <button
              className="chip-btn lvl-3"
              onClick={() => {
                store.resetDemo();
                setConfirmReset(false);
              }}
            >
              Reset
            </button>
            <button className="chip-btn" onClick={() => setConfirmReset(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button className="chip-btn" onClick={() => setConfirmReset(true)}>
            Reset demo
          </button>
        )}
      </div>
    </section>
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

function RolePicker({ persona, onPick }: { persona: AstronautId; onPick: (id: AstronautId) => void }) {
  const { state } = useRoom();
  return (
    <section className="roles" aria-labelledby="roles-title">
      <div className="roles__intro">
        <h2 id="roles-title" className="panel__title">
          View as
        </h2>
        <p>Pick a crew member to see the mission through their devices. Use Scenarios to change their readings.</p>
      </div>
      <div className="roles__list" role="radiogroup" aria-labelledby="roles-title">
        {CREW.map((a) => (
          <button
            key={a.id}
            role="radio"
            aria-checked={persona === a.id}
            aria-label={`${a.name}, ${a.cmo ? 'Medical officer' : a.role}, ${locationLabel(state, a.id)}`}
            className={`role-card${persona === a.id ? ' is-active' : ''}`}
            onClick={() => onPick(a.id)}
          >
            <strong>{a.name}</strong>
            <span>{a.cmo ? 'Medical officer' : a.role}</span>
            <small>{locationLabel(state, a.id)}</small>
          </button>
        ))}
      </div>
      <ul className="roles__sees" aria-label={`What ${CREW_BY_ID[persona].name} can see`}>
        {canSee(persona).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
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

        <RolePicker persona={persona} onPick={pick} />

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
                  <strong>{a.name}</strong>
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
