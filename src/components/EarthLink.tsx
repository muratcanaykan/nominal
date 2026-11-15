// Messages to flight surgeons on Earth, on the medical officer's tablet: send an update, a guidance request or an
// all clear about a crew member, then watch it cross the signal delay and the reply come back.

import { useState } from 'react';
import { CREW, CREW_BY_ID, PROFILES, type AstronautId } from '../domain/crew';
import {
  ANSWER_MS,
  arrivesAt,
  countdown,
  earthMessages,
  MESSAGE_LABELS,
  replyAt,
  replyText,
  stageOf,
  type EarthMessage,
  type MessageKind,
} from '../domain/earth';
import type { RoomState } from '../domain/room';
import { crewSummary } from '../domain/sim';
import { useStore } from '../lib/useRoom';
import { Avatar } from './Avatar';
import { formatDelay } from './bits';

/** Where a message is now, in a few words. */
export function stageText(m: EarthMessage, now: number): string {
  switch (stageOf(m, now)) {
    case 'outbound':
      return `On its way to Earth · arrives in ${countdown(arrivesAt(m) - now)}`;
    case 'answering':
      return `Flight surgeon answering · reply in ${countdown(replyAt(m) - now)}`;
    case 'inbound':
      return `Reply on its way · arrives in ${countdown(replyAt(m) - now)}`;
    default:
      return 'Reply received';
  }
}

function Message({ m, now }: { m: EarthMessage & { id: string }; now: number }) {
  const stage = stageOf(m, now);
  const total = replyAt(m) - m.at;
  const share = Math.min(1, (now - m.at) / total);
  return (
    <li className={`earth-msg is-${stage}`}>
      <div className="earth-msg__out">
        <header>
          <Avatar id={m.from} size={22} />
          <strong>{MESSAGE_LABELS[m.kind]}</strong>
          <span>about {CREW_BY_ID[m.about].name}</span>
        </header>
        <p>{m.text}</p>
      </div>
      <div className="earth-msg__track" aria-hidden="true">
        <span style={{ transform: `scaleX(${share})` }} />
        <i style={{ left: `${(m.delayMs / total) * 100}%` }} />
        <i style={{ left: `${((m.delayMs + ANSWER_MS) / total) * 100}%` }} />
      </div>
      <p className="earth-msg__stage" aria-live="polite">
        {stageText(m, now)}
      </p>
      {stage === 'replied' && (
        <div className="earth-msg__reply">
          <strong>Flight surgeon on duty</strong>
          <p>{replyText(m)}</p>
          <small>Simulated reply</small>
        </div>
      )}
    </li>
  );
}

export function EarthPanel({ state, now, from }: { state: RoomState | undefined; now: number; from: AstronautId }) {
  const store = useStore();
  const alerts = crewSummary(state, now).alerts;
  const [about, setAbout] = useState<AstronautId>(alerts[0]?.astronautId ?? CREW[1].id);
  const profile = PROFILES[state?.profile ?? 'lunar'];
  const round = 2 * profile.earthDelayMs + ANSWER_MS;
  const messages = earthMessages(state).slice(-4).reverse();
  return (
    <section className="panel earth" aria-labelledby="earth-title">
      <div className="medical__meta">
        <h2 id="earth-title" className="panel__title">
          Flight surgeons on Earth
        </h2>
        <span>
          {profile.label} · signal {formatDelay(profile.earthDelayMs)} each way · a reply takes about {countdown(round)}
        </span>
      </div>
      <p className="panel__hint">
        {profile.earthDelayMs >= 60_000
          ? 'From here a reply takes longer than most emergencies can wait: the crew acts first and keeps Earth informed.'
          : 'Earth is close enough for a quick reply, but the crew still acts first and keeps Earth informed.'}
      </p>
      <div className="earth__compose">
        <label>
          About
          <select value={about} onChange={(e) => setAbout(e.target.value as AstronautId)}>
            {CREW.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {alerts.some((a) => a.astronautId === c.id) ? ' · crew alert' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="earth__kinds">
          {(Object.keys(MESSAGE_LABELS) as MessageKind[]).map((k) => (
            <button key={k} className={k === 'status' ? 'btn-primary' : 'btn-secondary'} onClick={() => store.sendEarth(from, about, k)}>
              {MESSAGE_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
      {messages.length > 0 ? (
        <ol className="earth__list">
          {messages.map((m) => (
            <Message key={m.id} m={m} now={now} />
          ))}
        </ol>
      ) : (
        <p className="cmo-empty">No messages yet. Ticking "Send flight surgeons an update" on the cabin screen sends one too.</p>
      )}
    </section>
  );
}
