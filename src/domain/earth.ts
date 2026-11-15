// Messages to flight surgeons on Earth. A message travels at the speed of light, the flight surgeon on duty needs a
// moment to answer, and the answer travels back: from Mars that is close to half an hour, which is why the crew must
// act on its own first. Replies are simulated and computed from time, like the readings, so every screen agrees.

import { CREW_BY_ID, PROFILES, type AstronautId } from './crew';
import { locationLabel } from './locations';
import { checklistProgress } from './response';
import type { RoomState } from './room';
import { crewSummary, snapshot } from './sim';
import { LEVEL_NAMES, VITALS, type VitalId } from './vitals';

export type MessageKind = 'status' | 'guidance' | 'clear';

export const MESSAGE_LABELS: Record<MessageKind, string> = {
  status: 'Status update',
  guidance: 'Ask for guidance',
  clear: 'All clear',
};

export interface EarthMessage {
  from: AstronautId;
  about: AstronautId;
  kind: MessageKind;
  /** Composed when sent, from what the medical officer sees. */
  text: string;
  at: number;
  /** One-way signal delay when it was sent. */
  delayMs: number;
  /** The reading the message is about, for the reply. */
  vital?: VitalId;
  /** When the medical officer moved it to the archive. */
  archived?: number;
}

/** Time the flight surgeon on duty takes to read and answer (shortened for the demo). */
export const ANSWER_MS = 15_000;

/** "0:42" or "23 min" style countdown. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const arrivesAt = (m: EarthMessage) => m.at + m.delayMs;
export const replyAt = (m: EarthMessage) => m.at + 2 * m.delayMs + ANSWER_MS;

export type MessageStage = 'outbound' | 'answering' | 'inbound' | 'replied';

export function stageOf(m: EarthMessage, now: number): MessageStage {
  if (now < arrivesAt(m)) return 'outbound';
  if (now < arrivesAt(m) + ANSWER_MS) return 'answering';
  if (now < replyAt(m)) return 'inbound';
  return 'replied';
}

/** Messages, oldest first. */
export function earthMessages(state: RoomState | null | undefined): (EarthMessage & { id: string })[] {
  return Object.entries(state?.messages ?? {})
    .map(([id, m]) => ({ ...m, id }))
    .sort((a, b) => a.at - b.at);
}

/** The newest message about a crew member since `since`, if any. */
export function latestAbout(state: RoomState | null | undefined, id: AstronautId, since = 0) {
  return earthMessages(state)
    .filter((m) => m.about === id && m.at >= since)
    .pop();
}

/** Builds the message from what the medical officer sees now. */
export function composeMessage(
  state: RoomState | undefined,
  from: AstronautId,
  about: AstronautId,
  kind: MessageKind,
  now: number,
): EarthMessage {
  const name = CREW_BY_ID[about].name;
  const s = snapshot(state, about, now);
  const top = s.connected ? s.top : undefined;
  const reading = top ? `${VITALS[top.id].label.toLowerCase()} ${top.id === 'bloodPressure' ? `${top.value}/${top.secondary}` : top.value.toFixed(VITALS[top.id].decimals)}${VITALS[top.id].unit === '%' ? ' %' : ` ${VITALS[top.id].unit}`}` : '';
  const where = locationLabel(state, about).toLowerCase();
  const alert = crewSummary(state, now).alerts.find((a) => a.astronautId === about);
  const progress = alert ? checklistProgress(alert, state) : null;
  let text: string;
  if (kind === 'clear') {
    text = `${name} is stable and readings are back in range. Closing the event.`;
  } else if (!s.connected) {
    text = `${name}: no sensor data since the watch disconnected, ${where}. ${kind === 'guidance' ? 'Requesting guidance.' : 'Checking on them in person.'}`;
  } else if (kind === 'status') {
    text = top
      ? `${name}, ${where}: ${LEVEL_NAMES[top.level].toLowerCase()}, ${reading}.${progress ? ` Response checklist ${progress.done}/${progress.total} done.` : ''}`
      : `${name}, ${where}: all readings in range.`;
  } else {
    text = top ? `${name}, ${where}: ${reading}. Requesting guidance on next steps.` : `${name}, ${where}: readings in range, requesting a routine review.`;
  }
  const message: EarthMessage = { from, about, kind, text, at: now, delayMs: PROFILES[state?.profile ?? 'lunar'].earthDelayMs };
  // Firebase rejects undefined values: only add the reading when there is one.
  if (top) message.vital = top.id;
  return message;
}

const GUIDANCE: Partial<Record<VitalId, string>> = {
  spo2: 'keep them at rest on oxygen and recheck blood oxygen every 5 minutes',
  heartRate: 'keep them at rest, repeat the heart rate and blood pressure every 5 minutes and have the defibrillator ready',
  bloodPressure: 'keep them lying down and repeat blood pressure every 5 minutes',
  bodyTemp: 'recheck the temperature in 15 minutes and keep them hydrated',
  glucose: 'repeat the fingerstick 15 minutes after the carbohydrate',
  helmetCO2: 'end the spacewalk early and check the suit air flow once inside',
  helmetWater: 'bring them in now and keep the helmet on until the airlock is pressurised',
  fingerTempL: 'end the spacewalk early and rewarm the hand slowly once inside',
  fingerTempR: 'end the spacewalk early and rewarm the hand slowly once inside',
};

/** The simulated reply from the flight surgeon on duty. */
export function replyText(m: EarthMessage): string {
  const name = CREW_BY_ID[m.about].name.split(' ').slice(-1)[0];
  if (m.kind === 'clear') return `Copy, good to hear ${name} is stable. We will review the event data at the next medical conference.`;
  if (m.kind === 'status') return `Copy your update on ${name}. Continue your plan and send another update if anything changes.`;
  const advice = (m.vital && GUIDANCE[m.vital]) ?? 'continue monitoring and send the readings every 15 minutes';
  return `For ${name}: ${advice}. Your judgement on site comes first; we are reviewing the data you sent.`;
}
