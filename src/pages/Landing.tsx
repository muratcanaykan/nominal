import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { newRoomId, ROOM_ID_PATTERN } from '../lib/firebase';
import { createRoom } from '../lib/RoomRoute';
import { syncErrorMessage } from '../lib/retry';
import { HeroDemo } from '../components/HeroDemo';

export function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  async function start(tour = false) {
    setBusy(true);
    setError('');
    const id = newRoomId();
    try {
      await createRoom(id);
      navigate(tour ? `/r/${id}?tour=1` : `/r/${id}`);
    } catch (e) {
      setError(syncErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const id = code.trim().toUpperCase();
    if (!ROOM_ID_PATTERN.test(id)) {
      setError('Room codes have six letters or digits, for example K7Q2XM.');
      return;
    }
    navigate(`/r/${id}`);
  }

  return (
    <div className="page">
      <main className="landing">
        <section className="landing__hero">
          <div className="landing__intro">
            <p className="landing__eyebrow">Crew health monitor · Prototype</p>
            <h1 className="landing__title">Nominal</h1>
            <p className="landing__tag">Stay nominal.</p>
            <p className="landing__lead">
              Far from Earth, astronauts have to notice health changes in themselves. Nominal gives each crew member a wrist
              display with their own readings and clear guidance, a shared cabin screen that shows only what needs the
              crew, and a detailed view for the crew medical officer.
            </p>

            <div className="landing__actions">
              <button className="btn-primary landing__cta" onClick={() => start(true)} disabled={busy}>
                {busy ? 'Starting…' : '▶ Take the 1-minute tour'}
              </button>
              <button className="btn-secondary" onClick={() => start()} disabled={busy}>
                Start a live demo
              </button>
            </div>
            <form className="landing__join" onSubmit={join}>
              <label htmlFor="room-code">Join a demo</label>
              <input
                id="room-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Room code"
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn-secondary" type="submit">
                Join
              </button>
            </form>
            {error && (
              <p className="landing__error" role="alert">
                {error}
              </p>
            )}
          </div>
          <HeroDemo />
        </section>

        <ul className="landing__points">
          <li>
            <strong>Watch</strong>
            <span>Your own readings, colour-coded alerts, an early warning before a threshold and what to do about it.</span>
          </li>
          <li>
            <strong>Cabin screen</strong>
            <span>Only the alerts that need the crew, with a live 3D view of who is where. Routine values stay private.</span>
          </li>
          <li>
            <strong>Medical officer</strong>
            <span>Details, trends, radiation dose and history for the crew member responsible for care.</span>
          </li>
          <li>
            <strong>Suit sensors</strong>
            <span>Fingertip temperature, helmet CO₂ and water, shoulder pressure: marked on a body map and in 3D.</span>
          </li>
        </ul>

        <section className="landing__data" aria-labelledby="landing-data">
          <h2 id="landing-data">Built on open NASA data</h2>
          <ul>
            <li>
              <strong>Space weather</strong>
              <span>Solar particle events from NASA DONKI raise a radiation advisory and the dose rate.</span>
            </li>
            <li>
              <strong>Crew baselines</strong>
              <span>Pre-flight glucose of a commercial spaceflight crew from NASA OSDR (OSD-575).</span>
            </li>
            <li>
              <strong>3D astronaut</strong>
              <span>The astronaut model from NASA 3D Resources in the mission simulation.</span>
            </li>
            <li>
              <strong>Health risks</strong>
              <span>The NASA Human Research Program hazards behind the thresholds and explanations.</span>
            </li>
          </ul>
        </section>

        <p className="landing__note">
          Open the same demo on several devices: every screen updates live. All physiological data is simulated; thresholds
          are prototype values, not clinically validated.
        </p>
      </main>
    </div>
  );
}
