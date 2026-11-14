// Red glow around the page while an alert needs the crew, plus the switch for the alert sound.

import type { AlarmState } from '../lib/useCrewAlarm';

export function AlarmGlow({ state }: { state: AlarmState }) {
  return <div className={`alarm-glow${state ? ` is-${state}` : ''}`} aria-hidden="true" />;
}

export function SoundSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button className={`switch-btn${on ? ' is-on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)} title="Alert sound for critical crew alerts">
      <span className="switch-btn__track" aria-hidden="true">
        <span />
      </span>
      Alert sound
    </button>
  );
}
