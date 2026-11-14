import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { newRoomId, ROOM_ID_PATTERN } from '../lib/firebase';
import { createRoom } from '../lib/RoomRoute';
import { useStyledPath, useVariant } from '../lib/variant';

export function Landing() {
  const variant = useVariant();
  const navigate = useNavigate();
  const styled = useStyledPath();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    const id = newRoomId();
    try {
      await createRoom(id);
      navigate(styled(`/r/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
    navigate(styled(`/r/${id}`));
  }

  return (
    <div className={`page v-${variant}`}>
      <main className="landing">
        <p className="landing__eyebrow">Crew health monitor · Prototype</p>
        <h1 className="landing__title">Nominal</h1>
        <p className="landing__tag">Stay nominal.</p>
        <p className="landing__lead">
          Far from Earth, astronauts have to notice health changes in themselves. Nominal gives each crew member a wrist
          display with their own readings and clear guidance, a shared cabin screen that shows only what needs the crew,
          and a detailed view for the crew medical officer.
        </p>

        <div className="landing__actions">
          <button className="btn-primary" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Start a live demo'}
          </button>
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
        </div>
        {error && (
          <p className="landing__error" role="alert">
            {error}
          </p>
        )}

        <ul className="landing__points">
          <li>
            <strong>Watch</strong>
            <span>Your own readings, colour-coded alerts and what to do about them.</span>
          </li>
          <li>
            <strong>Cabin screen</strong>
            <span>Only the alerts that need the crew. Routine values stay private.</span>
          </li>
          <li>
            <strong>Medical officer</strong>
            <span>Details, trends and history for the crew member responsible for care.</span>
          </li>
        </ul>

        <p className="landing__note">
          Open the same demo on several devices: every screen updates live. All physiological data is simulated.
        </p>
      </main>
    </div>
  );
}
