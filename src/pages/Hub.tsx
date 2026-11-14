// Demo control: open the screens on other devices, drive scenarios, and preview the watch and cabin side by side.

import { useState } from 'react';
import { Link } from 'react-router';
import { CabinScreen } from '../components/CabinScreen';
import { Qr } from '../components/Qr';
import { WatchFace } from '../components/WatchFace';
import { CREW, PROFILES, type AstronautId, type ProfileId } from '../domain/crew';
import { activeScenario, type ScenarioId } from '../domain/scenarios';
import { useRoomId } from '../lib/RoomRoute';
import { useNow, useRoom, useStore } from '../lib/useRoom';

const SCENARIO_BUTTONS: { id: ScenarioId; label: string; level: string }[] = [
  { id: 'nominal', label: 'Nominal', level: 'lvl-0' },
  { id: 'caution', label: 'High heart rate', level: 'lvl-1' },
  { id: 'lowGlucose', label: 'Low glucose', level: 'lvl-1' },
  { id: 'warning', label: 'Falling SpO₂', level: 'lvl-2' },
  { id: 'fever', label: 'Fever', level: 'lvl-2' },
  { id: 'critical', label: 'Hypoxia', level: 'lvl-3' },
  { id: 'nodata', label: 'Sensor offline', level: 'lvl-nodata' },
];

function ScenarioPanel() {
  const store = useStore();
  const { state } = useRoom();
  return (
    <div className="panel">
      <h2 className="panel__title">Scenarios</h2>
      <div className="scenario-table">
        {CREW.map((a) => {
          const active = activeScenario(state, a.id);
          const help = state?.help?.[a.id];
          return (
            <div key={a.id} className="scenario-row">
              <div className="scenario-row__who">
                <strong>{a.name}</strong>
                <span>{a.location}</span>
              </div>
              <div className="scenario-row__buttons">
                {SCENARIO_BUTTONS.map((b) => (
                  <button
                    key={b.id}
                    className={`chip-btn ${b.level}${active === b.id ? ' is-active' : ''}`}
                    aria-pressed={active === b.id}
                    onClick={() => store.runScenario(a.id, b.id)}
                  >
                    {b.label}
                  </button>
                ))}
                <button
                  className={`chip-btn lvl-3${help ? ' is-active' : ''}`}
                  aria-pressed={!!help}
                  onClick={() => (help ? store.cancelHelp(a.id) : store.requestHelp(a.id))}
                >
                  Help call
                </button>
                <button className="chip-btn" onClick={() => store.askMood(a.id)}>
                  Ask mood
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionPanel() {
  const store = useStore();
  const { state } = useRoom();
  const [confirmReset, setConfirmReset] = useState(false);
  const profile = state?.profile ?? 'lunar';
  const solar = !!state?.spaceWeather?.sepAt;
  return (
    <div className="panel">
      <h2 className="panel__title">Mission</h2>
      <div className="mission-controls">
        <div className="segmented" role="radiogroup" aria-label="Mission location">
          {(Object.keys(PROFILES) as ProfileId[]).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={profile === p}
              className={profile === p ? 'is-active' : ''}
              onClick={() => store.setProfile(p)}
            >
              {PROFILES[p].label}
            </button>
          ))}
        </div>
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
    </div>
  );
}

function ScreenLinks({ roomId }: { roomId: string }) {
  const origin = window.location.origin;
  const screens = [
    { path: `/r/${roomId}/cabin`, title: 'Cabin screen', sub: 'Shared display in the vehicle' },
    { path: `/r/${roomId}/cmo`, title: 'Medical officer', sub: 'Demo PIN 2468' },
    ...CREW.map((a) => ({ path: `/r/${roomId}/watch/${a.id}`, title: `Watch · ${a.callsign}`, sub: a.name })),
  ];
  return (
    <div className="panel" id="screens">
      <h2 className="panel__title">Open the screens on other devices</h2>
      <p className="panel__hint">Scan a code with a phone to wear the watch, or open the cabin screen on a second computer.</p>
      <div className="screen-grid">
        {screens.map((s) => (
          <div key={s.path} className="screen-card">
            <Qr url={origin + s.path} label={s.title} />
            <div className="screen-card__text">
              <strong>{s.title}</strong>
              <span>{s.sub}</span>
              <Link to={s.path} target="_blank" rel="noopener">
                Open in new tab
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Explains the three screens and walks a first-time visitor (or a judge) through one scenario. */
function Guide() {
  return (
    <details className="panel guide" open>
      <summary className="panel__title">How this demo works</summary>
      <div className="guide__devices">
        <div className="guide__device">
          <strong>Watch</strong>
          <span>
            Worn by each astronaut. Shows only that person's own readings, colour-coded alerts, what to do, and a help
            button. Best opened on a phone.
          </span>
        </div>
        <div className="guide__device">
          <strong>Cabin screen</strong>
          <span>
            The shared display inside the vehicle. Everyone on board can see and use it. It never shows health values:
            only device status and the alerts that need the crew.
          </span>
        </div>
        <div className="guide__device">
          <strong>Medical officer</strong>
          <span>
            The detailed view for the crew member responsible for care: every value, trends, history and space weather.
            Opens with the demo PIN 2468.
          </span>
        </div>
      </div>
      <ol className="guide__steps">
        <li>
          Open the cabin screen on a second screen and a watch on your phone (<a href="#screens">QR codes below</a>), or
          just use the live preview on this page.
        </li>
        <li>
          Press <b>Falling SpO₂</b> for Daniel Okafor. His watch warns him and the medical officer is told; the cabin
          screen stays private.
        </li>
        <li>
          Press <b>Hypoxia</b>. Now the whole crew sees it on the cabin screen and flight surgeons on Earth are notified.
        </li>
        <li>
          On the cabin screen, press <b>I'm responding</b>. Every screen shows who is on the way.
        </li>
      </ol>
    </details>
  );
}

export function Hub() {
  const roomId = useRoomId();
  const now = useNow(250);
  const [focus, setFocus] = useState<AstronautId>('02');
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}${window.location.search}`;

  return (
    <main className="hub">
      <header className="hub__head">
        <div>
          <p className="hub__eyebrow">Nominal · Demo control</p>
          <h1 className="hub__title">
            Room <span className="hub__code">{roomId}</span>
          </h1>
        </div>
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
      </header>

      <Guide />
      <ScenarioPanel />

      <div className="panel">
        <div className="preview-head">
          <h2 className="panel__title">Live preview</h2>
          <div className="segmented" role="radiogroup" aria-label="Watch to preview">
            {CREW.map((a) => (
              <button key={a.id} role="radio" aria-checked={focus === a.id} className={focus === a.id ? 'is-active' : ''} onClick={() => setFocus(a.id)}>
                {a.callsign}
              </button>
            ))}
          </div>
        </div>
        <div className="preview">
          <WatchFace astronautId={focus} now={now} />
          <CabinScreen now={now} />
        </div>
      </div>

      <ScreenLinks roomId={roomId} />
      <MissionPanel />
    </main>
  );
}
