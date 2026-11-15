// Tether pull: the commander or the medical officer pulls a spacewalker back to the airlock in a crew emergency.
// Everyone sees a pull in progress; only those two roles get the button, and it asks for a second tap.

import { useEffect, useState } from 'react';
import { CREW_BY_ID, type AstronautId } from '../domain/crew';
import { canPull, PULL_MS, pullOf } from '../domain/tether';
import { useRoom, useStore } from '../lib/useRoom';

const surname = (id: AstronautId) => CREW_BY_ID[id].name.split(' ').slice(-1)[0];

/** `by` is the crew member using this screen. Renders nothing when there is no pull and `by` cannot start one. */
export function TetherPull({ id, by, now }: { id: AstronautId; by: AstronautId; now: number }) {
  const store = useStore();
  const { state } = useRoom();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const pull = pullOf(state, id, now);
  if (pull?.active) {
    return (
      <div className="pull" role="status">
        <span className="pull__text">
          <strong>Tether pull</strong> · {CREW_BY_ID[pull.by].name} is bringing {surname(id)} to the airlock ·{' '}
          {Math.ceil(pull.left / 1000)} s
        </span>
        <span className="pull__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${1 - pull.left / PULL_MS})` }} />
        </span>
      </div>
    );
  }
  if (!canPull(state, id, by, now)) return null;
  return (
    <button
      className={`btn-pull${armed ? ' is-armed' : ''}`}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        void store.pullIn(id, by);
      }}
    >
      {armed ? `Tap again to pull ${surname(id)} in` : 'Pull in by tether'}
      <small>{armed ? 'The reel brings them to the airlock' : 'Commander and medical officer only'}</small>
    </button>
  );
}
